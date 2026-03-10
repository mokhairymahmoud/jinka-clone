import { randomUUID } from "node:crypto";

import {
  FraudLabel as PrismaFraudLabel,
  ListingPurpose as PrismaListingPurpose,
  Prisma,
  ListingSource as PrismaListingSource,
  MarketSegment as PrismaMarketSegment,
  PrismaClient,
  SourceListingStatus as PrismaSourceListingStatus
} from "@prisma/client";

import type { ListingSource } from "@jinka-eg/types";
import type { QueueMap } from "./queue.js";
import type { NormalizedListingCandidate, ParsedListingCandidate, RawPageResult, SourceSeed } from "./connector.js";
import {
  AUTO_ATTACH_EDGE_THRESHOLD,
  REVIEW_EDGE_THRESHOLD,
  scoreDuplicateCandidate,
  type DedupComparableListing
} from "./deduplication.js";
import { createRawSnapshotStorage, type RawSnapshotStorage } from "./object-storage.js";
import { getConnector } from "./source-registry.js";
import { hashImageUrls, normalizeArea, resolveCoordinates } from "./normalization.js";

type SeedSourcePayload = {
  source: ListingSource;
};

type FetchPagePayload = {
  source: ListingSource;
  runId: string;
  seed: SourceSeed;
  partitionId?: string;
};

type ParseSnapshotPayload = {
  source: ListingSource;
  runId: string;
  rawSnapshotId: string;
  seed: SourceSeed;
  partitionId?: string;
};

type NormalizeVariantPayload = {
  source: ListingSource;
  runId: string;
  rawSnapshotId: string;
  seed: SourceSeed;
  candidate: ParsedListingCandidate;
  expectedTotal: number;
  finalizeRunOnComplete?: boolean;
  partitionId?: string;
};

type PipelineStagePayload = {
  source: ListingSource;
  runId: string;
  stage: "score-cluster" | "score-fraud" | "match-alerts" | "send-notification";
  clusterId?: string;
  eventType?: "new_listing" | "price_drop";
  notificationIds?: string[];
};

type AlertFilterRecord = Record<string, unknown>;

type PersistedVariantRecord = Prisma.ListingVariantGetPayload<{
  include: {
    priceHistory: {
      orderBy: {
        recordedAt: "desc";
      };
    };
  };
}>;

type ClusterSyncResult = {
  clusterId: string;
  eventType?: "new_listing" | "price_drop";
  reviewEdgeCount: number;
  autoAttached: boolean;
  collapsedCluster: boolean;
};

function toPrismaSource(source: ListingSource) {
  switch (source) {
    case "nawy":
      return PrismaListingSource.NAWY;
    case "property_finder":
      return PrismaListingSource.PROPERTY_FINDER;
    case "aqarmap":
      return PrismaListingSource.AQARMAP;
    case "facebook":
      return PrismaListingSource.FACEBOOK;
  }
}

function toPrismaPurpose(purpose: "rent" | "sale") {
  return purpose === "rent" ? PrismaListingPurpose.RENT : PrismaListingPurpose.SALE;
}

function toPrismaMarketSegment(segment: "resale" | "primary" | "off_plan") {
  switch (segment) {
    case "primary":
      return PrismaMarketSegment.PRIMARY;
    case "off_plan":
      return PrismaMarketSegment.OFF_PLAN;
    default:
      return PrismaMarketSegment.RESALE;
  }
}

function buildStorageKey(source: ListingSource, runId: string, seedLabel: string, payloadType: "html" | "json") {
  const safeLabel = seedLabel.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return `${source}/${runId}/${safeLabel}-${randomUUID()}.${payloadType === "json" ? "json" : "html"}`;
}

function getNextPartitionCrawlAt(priority = 100, from = new Date()) {
  const intervalMinutes =
    priority <= 25 ? 5 : priority <= 50 ? 15 : priority <= 80 ? 60 : priority <= 110 ? 360 : 720;

  return new Date(from.getTime() + intervalMinutes * 60_000);
}

function toJsonCoordinates(coordinates?: { lat: number; lng: number } | null) {
  if (!coordinates) {
    return null;
  }

  return {
    lat: coordinates.lat,
    lng: coordinates.lng
  } satisfies Prisma.InputJsonObject;
}

function toJsonLocalizedText(value?: { en: string; ar: string } | null) {
  if (!value) {
    return null;
  }

  return {
    en: value.en,
    ar: value.ar
  } satisfies Prisma.InputJsonObject;
}

function isWithinQuietHours(start?: string | null, end?: string | null) {
  if (!start || !end) {
    return false;
  }

  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const [startHours, startMinutes] = start.split(":").map(Number);
  const [endHours, endMinutes] = end.split(":").map(Number);
  const startTotal = startHours * 60 + startMinutes;
  const endTotal = endHours * 60 + endMinutes;

  if (Number.isNaN(startTotal) || Number.isNaN(endTotal)) {
    return false;
  }

  if (startTotal <= endTotal) {
    return minutesNow >= startTotal && minutesNow <= endTotal;
  }

  return minutesNow >= startTotal || minutesNow <= endTotal;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  }

  return undefined;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];
}

function asLocalizedText(value: unknown) {
  const record = asRecord(value);
  const en = asString(record?.en);
  const ar = asString(record?.ar);

  if (!en && !ar) {
    return undefined;
  }

  const fallback = en ?? ar ?? "";
  return {
    en: en ?? fallback,
    ar: ar ?? fallback
  };
}

function asCoordinates(value: unknown) {
  const record = asRecord(value);
  const lat = asNumber(record?.lat);
  const lng = asNumber(record?.lng ?? record?.lon);

  return lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
}

export class IngestionPipeline {
  constructor(
    private readonly queues: QueueMap,
    private readonly prisma = new PrismaClient(),
    private readonly storage: RawSnapshotStorage = createRawSnapshotStorage()
  ) {}

  async close() {
    await this.prisma.$disconnect();
  }

  async syncSourcePartitions(sources: ListingSource[]) {
    const enabledSources = await this.filterEnabledSources(sources);
    let syncedPartitions = 0;

    for (const source of enabledSources) {
      const connector = getConnector(source);
      const seeds = await connector.discover();
      const labels = seeds.map((seed) => seed.label);

      await this.prisma.sourcePartition.updateMany({
        where: {
          source: toPrismaSource(source),
          ...(labels.length > 0
            ? {
                label: {
                  notIn: labels
                }
              }
            : {})
        },
        data: {
          isActive: false
        }
      });

      for (const seed of seeds) {
        await this.prisma.sourcePartition.upsert({
          where: {
            source_label: {
              source: toPrismaSource(source),
              label: seed.label
            }
          },
          update: {
            seedUrl: seed.url,
            purpose: seed.purpose ? toPrismaPurpose(seed.purpose) : undefined,
            marketSegment: seed.marketSegment ? toPrismaMarketSegment(seed.marketSegment) : undefined,
            propertyType: seed.propertyType,
            areaSlug: seed.areaSlug,
            page: seed.page,
            priority: seed.priority ?? 100,
            isActive: true
          },
          create: {
            source: toPrismaSource(source),
            label: seed.label,
            seedUrl: seed.url,
            purpose: seed.purpose ? toPrismaPurpose(seed.purpose) : undefined,
            marketSegment: seed.marketSegment ? toPrismaMarketSegment(seed.marketSegment) : undefined,
            propertyType: seed.propertyType,
            areaSlug: seed.areaSlug,
            page: seed.page,
            priority: seed.priority ?? 100,
            nextCrawlAt: new Date()
          }
        });
        syncedPartitions += 1;
      }
    }

    return {
      requestedSources: sources,
      syncedSources: enabledSources,
      syncedPartitions
    };
  }

  async enqueueSources(sources: ListingSource[]) {
    const enabledSources = await this.filterEnabledSources(sources);
    await this.syncSourcePartitions(enabledSources);

    await Promise.all(
      enabledSources.map((source) =>
        this.queues["seed-source"].add(`seed:${source}:${Date.now()}`, {
          source
        } satisfies SeedSourcePayload)
      )
    );

    return {
      requestedSources: sources,
      queuedSources: enabledSources,
      skippedSources: sources.filter((source) => !enabledSources.includes(source))
    };
  }

  async enqueueDuePartitions(options: { sources: ListingSource[]; limit?: number } = { sources: [] }) {
    const enabledSources = await this.filterEnabledSources(options.sources);

    if (enabledSources.length === 0) {
      return {
        requestedSources: options.sources,
        queuedPartitions: 0,
        queuedSources: [] as ListingSource[]
      };
    }

    const partitions = await this.prisma.sourcePartition.findMany({
      where: {
        source: {
          in: enabledSources.map((source) => toPrismaSource(source))
        },
        isActive: true,
        nextCrawlAt: {
          lte: new Date()
        }
      },
      orderBy: [{ priority: "asc" }, { nextCrawlAt: "asc" }],
      take: options.limit ?? 25
    });

    for (const partition of partitions) {
      const source = this.fromPrismaSource(partition.source);
      const run = await this.prisma.ingestionRun.create({
        data: {
          source: partition.source,
          status: "running"
        }
      });

      await this.queues["discover-page"].add(`discover:${source}:${run.id}:${partition.label}`, {
        source,
        runId: run.id,
        partitionId: partition.id,
        seed: {
          source,
          url: partition.seedUrl,
          label: partition.label,
          seedKind: "discovery",
          sweepToken: randomUUID(),
          purpose: partition.purpose ? this.fromPrismaPurpose(partition.purpose) : undefined,
          marketSegment: partition.marketSegment ? this.fromPrismaMarketSegment(partition.marketSegment) : undefined,
          propertyType: partition.propertyType as SourceSeed["propertyType"] | undefined,
          areaSlug: partition.areaSlug ?? undefined,
          page: 1,
          priority: partition.priority
        }
      } satisfies FetchPagePayload);
    }

    return {
      requestedSources: options.sources,
      queuedPartitions: partitions.length,
      queuedSources: [...new Set(partitions.map((partition) => this.fromPrismaSource(partition.source)))]
    };
  }

  async enqueueDueDetailRefreshes(options: { sources: ListingSource[]; limit?: number }) {
    const enabledSources = await this.filterEnabledSources(options.sources);
    const supportedSources = enabledSources.filter((source) => getConnector(source).supportsDetailRefresh());

    if (supportedSources.length === 0) {
      return {
        requestedSources: options.sources,
        queuedVariants: 0,
        queuedSources: [] as ListingSource[]
      };
    }

    const now = new Date();
    const hotRecentCutoff = new Date(now.getTime() - Number(process.env.CRAWLER_DETAIL_HOT_WINDOW_HOURS ?? "12") * 60 * 60_000);
    const warmRecentCutoff = new Date(now.getTime() - Number(process.env.CRAWLER_DETAIL_WARM_WINDOW_HOURS ?? "72") * 60 * 60_000);
    const hotRefreshCutoff = new Date(now.getTime() - Number(process.env.CRAWLER_DETAIL_HOT_REFRESH_MINUTES ?? "30") * 60_000);
    const warmRefreshCutoff = new Date(now.getTime() - Number(process.env.CRAWLER_DETAIL_WARM_REFRESH_MINUTES ?? "180") * 60_000);
    const coldRefreshCutoff = new Date(now.getTime() - Number(process.env.CRAWLER_DETAIL_COLD_REFRESH_MINUTES ?? "720") * 60_000);
    const variants = await this.prisma.listingVariant.findMany({
      where: {
        source: {
          in: supportedSources.map((source) => toPrismaSource(source))
        },
        inactiveAt: null,
        canonicalUrl: {
          not: ""
        },
        OR: [
          {
            lastSeenAt: {
              gte: hotRecentCutoff
            },
            lastCrawledAt: {
              lt: hotRefreshCutoff
            }
          },
          {
            lastSeenAt: {
              lt: hotRecentCutoff,
              gte: warmRecentCutoff
            },
            lastCrawledAt: {
              lt: warmRefreshCutoff
            }
          },
          {
            lastSeenAt: {
              lt: warmRecentCutoff
            },
            lastCrawledAt: {
              lt: coldRefreshCutoff
            }
          }
        ]
      },
      orderBy: [{ lastCrawledAt: "asc" }, { updatedAt: "asc" }],
      take: options.limit ?? 50
    });

    for (const variant of variants) {
      const source = this.fromPrismaSource(variant.source);
      const run = await this.prisma.ingestionRun.create({
        data: {
          source: variant.source,
          status: "running"
        }
      });

      await this.queues["fetch-detail"].add(`detail:${source}:${variant.id}:${Date.now()}`, {
        source,
        runId: run.id,
        seed: {
          source,
          url: variant.canonicalUrl,
          label: `detail-${variant.sourceListingId}`,
          seedKind: "detail_refresh",
          sourceListingId: variant.sourceListingId,
          refreshVariantId: variant.id,
          priority: 35
        }
      } satisfies FetchPagePayload);
    }

    return {
      requestedSources: options.sources,
      queuedVariants: variants.length,
      queuedSources: [...new Set(variants.map((variant) => this.fromPrismaSource(variant.source)))]
    };
  }

  async markInactiveVariants(options: { sources: ListingSource[]; staleHours?: number }) {
    const enabledSources = await this.filterEnabledSources(options.sources);
    const staleHours = options.staleHours ?? Number(process.env.CRAWLER_STALE_AFTER_HOURS ?? "48");
    const missThreshold = Number(process.env.CRAWLER_DETAIL_REFRESH_MAX_MISSES ?? "3");
    const cutoff = new Date(Date.now() - staleHours * 60 * 60_000);
    const supportedSources = enabledSources.filter((source) => getConnector(source).supportsDetailRefresh());
    const unsupportedSources = enabledSources.filter((source) => !getConnector(source).supportsDetailRefresh());
    let markedInactive = 0;

    if (supportedSources.length > 0) {
      const result = await this.prisma.listingVariant.updateMany({
        where: {
          source: {
            in: supportedSources.map((source) => toPrismaSource(source))
          },
          refreshMissCount: {
            gte: missThreshold
          },
          inactiveAt: null,
          clusterId: {
            not: null
          },
          sourceStatus: {
            not: PrismaSourceListingStatus.BLOCKED
          }
        },
        data: {
          inactiveAt: new Date(),
          sourceStatus: PrismaSourceListingStatus.REMOVED
        }
      });
      markedInactive += result.count;
    }

    if (unsupportedSources.length > 0) {
      const result = await this.prisma.listingVariant.updateMany({
        where: {
          source: {
            in: unsupportedSources.map((source) => toPrismaSource(source))
          },
          lastSeenAt: {
            lt: cutoff
          },
          inactiveAt: null,
          clusterId: {
            not: null
          },
          sourceStatus: {
            not: PrismaSourceListingStatus.BLOCKED
          }
        },
        data: {
          inactiveAt: new Date(),
          sourceStatus: PrismaSourceListingStatus.MISSING
        }
      });
      markedInactive += result.count;
    }

    return {
      sources: enabledSources,
      cutoff: cutoff.toISOString(),
      markedInactive
    };
  }

  async handleSeedSource(payload: SeedSourcePayload) {
    if (!(await this.isSourceEnabled(payload.source))) {
      return { source: payload.source, discoveredSeeds: 0, skipped: true };
    }

    const connector = getConnector(payload.source);
    const seeds = await connector.discover();

    if (seeds.length === 0) {
      return { source: payload.source, discoveredSeeds: 0 };
    }

    const partitions = await this.prisma.sourcePartition.findMany({
      where: {
        source: toPrismaSource(payload.source),
        label: {
          in: seeds.map((seed) => seed.label)
        }
      }
    });
    const partitionIdsByLabel = new Map(partitions.map((partition) => [partition.label, partition.id]));

    await Promise.all(
      seeds.map(async (seed) => {
        const run = await this.prisma.ingestionRun.create({
          data: {
            source: toPrismaSource(payload.source),
            status: "running"
          }
        });

        return this.queues["discover-page"].add(`discover:${payload.source}:${run.id}:${seed.label}`, {
          source: payload.source,
          runId: run.id,
          partitionId: partitionIdsByLabel.get(seed.label),
          seed: {
            ...seed,
            source: payload.source,
            seedKind: "discovery",
            sweepToken: randomUUID(),
            page: seed.page ?? 1
          }
        } satisfies FetchPagePayload);
      })
    );

    return { source: payload.source, discoveredSeeds: seeds.length };
  }

  async handleDiscoveryPage(payload: FetchPagePayload) {
    const connector = getConnector(payload.source);
    const raw = await connector.fetch(payload.seed);

    if (await this.isBlacklisted(payload.source, raw.url, raw.sourceListingId)) {
      await this.prisma.ingestionRun.update({
        where: { id: payload.runId },
        data: {
          completedAt: new Date(),
          status: "completed"
        }
      });

      if (payload.partitionId) {
        await this.updatePartitionDiscoveryState(payload.partitionId, payload.seed.page ?? 1, null, "blacklisted_seed", true);
      }

      return { source: payload.source, skipped: true, reason: "blacklisted_discovery" };
    }

    const rawSnapshot = await this.persistRawSnapshot(payload.source, payload.runId, payload.seed, raw);
    const candidates = await this.parseCandidates(payload.source, rawSnapshot.id, payload.seed);
    const partition = payload.partitionId
      ? await this.prisma.sourcePartition.findUnique({
          where: { id: payload.partitionId }
        })
      : null;
    const controls = connector.getDiscoveryControls(raw, candidates, payload.seed, partition?.lastDiscoverySignature ?? null);

    await this.prisma.ingestionRun.update({
      where: { id: payload.runId },
      data: {
        discoveredCount: {
          increment: candidates.length
        }
      }
    });

    if (payload.partitionId && payload.seed.sweepToken) {
      await this.recordPartitionSeenListings(payload.partitionId, payload.source, payload.seed.sweepToken, candidates);
      await this.updatePartitionDiscoveryState(
        payload.partitionId,
        payload.seed.page ?? 1,
        controls.pageSignature ?? null,
        controls.stopReason ?? null,
        !controls.nextSeed
      );
    }

    if (controls.nextSeed && payload.partitionId) {
      await this.queues["discover-page"].add(`discover:${payload.source}:${payload.runId}:${controls.nextSeed.label}:p${controls.nextSeed.page ?? 1}`, {
        source: payload.source,
        runId: payload.runId,
        partitionId: payload.partitionId,
        seed: {
          ...controls.nextSeed,
          source: payload.source,
          seedKind: "discovery",
          sweepToken: payload.seed.sweepToken
        }
      } satisfies FetchPagePayload);
    }

    if (candidates.length === 0) {
      await this.prisma.rawSnapshot.update({
        where: { id: rawSnapshot.id },
        data: {
          extractionCoverage: 0
        }
      });

      if (!controls.nextSeed) {
        if (payload.partitionId && payload.seed.sweepToken) {
          await this.reconcilePartitionMisses(payload.partitionId, payload.seed.sweepToken);
        }

        await this.prisma.ingestionRun.update({
          where: { id: payload.runId },
          data: {
            status: "completed",
            extractionRate: 0,
            completedAt: new Date()
          }
        });
        await this.syncParserDriftAlarm(payload.runId);
      }

      return { source: payload.source, candidates: 0, stopReason: controls.stopReason ?? "no_results" };
    }

    await Promise.all(
      candidates.map((candidate, index) =>
        this.queues["reconcile-variant"].add(`reconcile:${payload.source}:${rawSnapshot.id}:${index}`, {
          source: payload.source,
          runId: payload.runId,
          rawSnapshotId: rawSnapshot.id,
          seed: payload.seed,
          candidate,
          expectedTotal: candidates.length,
          finalizeRunOnComplete: !controls.nextSeed,
          partitionId: payload.partitionId
        } satisfies NormalizeVariantPayload)
      )
    );

    if (!controls.nextSeed && payload.partitionId && payload.seed.sweepToken) {
      await this.reconcilePartitionMisses(payload.partitionId, payload.seed.sweepToken);
    }

    return {
      source: payload.source,
      candidates: candidates.length,
      nextPage: controls.nextSeed?.page,
      stopReason: controls.stopReason
    };
  }

  async handleFetchDetail(payload: FetchPagePayload) {
    const raw = await getConnector(payload.source).fetch(payload.seed);

    if (await this.isBlacklisted(payload.source, raw.url, raw.sourceListingId)) {
      if (payload.seed.refreshVariantId) {
        await this.markVariantBlocked(payload.seed.refreshVariantId);
      }

      await this.prisma.ingestionRun.update({
        where: { id: payload.runId },
        data: {
          completedAt: new Date(),
          status: "completed"
        }
      });

      return { source: payload.source, skipped: true, reason: "blacklisted_detail" };
    }

    const rawSnapshot = await this.persistRawSnapshot(payload.source, payload.runId, payload.seed, raw);
    const candidates = await this.parseCandidates(payload.source, rawSnapshot.id, payload.seed);

    await this.prisma.ingestionRun.update({
      where: { id: payload.runId },
      data: {
        discoveredCount: {
          increment: candidates.length
        }
      }
    });

    if (candidates.length === 0) {
      await this.prisma.rawSnapshot.update({
        where: { id: rawSnapshot.id },
        data: {
          extractionCoverage: 0
        }
      });

      if (payload.seed.refreshVariantId) {
        await this.markVariantRefreshMiss(payload.seed.refreshVariantId);
      }

      await this.prisma.ingestionRun.update({
        where: { id: payload.runId },
        data: {
          status: "completed",
          extractionRate: 0,
          completedAt: new Date()
        }
      });
      await this.syncParserDriftAlarm(payload.runId);

      return { source: payload.source, candidates: 0 };
    }

    await Promise.all(
      candidates.map((candidate, index) =>
        this.queues["reconcile-variant"].add(`reconcile-detail:${payload.source}:${rawSnapshot.id}:${index}`, {
          source: payload.source,
          runId: payload.runId,
          rawSnapshotId: rawSnapshot.id,
          seed: payload.seed,
          candidate,
          expectedTotal: candidates.length,
          finalizeRunOnComplete: true
        } satisfies NormalizeVariantPayload)
      )
    );

    return { source: payload.source, candidates: candidates.length };
  }

  async handleFetchPage(payload: FetchPagePayload) {
    return payload.seed.seedKind === "detail_refresh"
      ? this.handleFetchDetail(payload)
      : this.handleDiscoveryPage(payload);
  }

  async handleParseSnapshot(payload: ParseSnapshotPayload) {
    const candidates = await this.parseCandidates(payload.source, payload.rawSnapshotId, payload.seed);

    await this.prisma.ingestionRun.update({
      where: { id: payload.runId },
      data: {
        discoveredCount: {
          increment: candidates.length
        }
      }
    });

    if (candidates.length === 0) {
      await this.prisma.rawSnapshot.update({
        where: { id: payload.rawSnapshotId },
        data: {
          extractionCoverage: 0
        }
      });
      await this.prisma.ingestionRun.update({
        where: { id: payload.runId },
        data: {
          status: "completed",
          completedAt: new Date()
        }
      });

      if (payload.seed.seedKind === "detail_refresh" && payload.seed.refreshVariantId) {
        await this.markVariantRefreshMiss(payload.seed.refreshVariantId);
      }

      await this.syncParserDriftAlarm(payload.runId);
      return { source: payload.source, candidates: 0 };
    }

    await Promise.all(
      candidates.map((candidate, index) =>
        this.queues["reconcile-variant"].add(`reconcile:${payload.source}:${payload.rawSnapshotId}:${index}`, {
          source: payload.source,
          runId: payload.runId,
          rawSnapshotId: payload.rawSnapshotId,
          seed: payload.seed,
          candidate,
          expectedTotal: candidates.length,
          finalizeRunOnComplete: true,
          partitionId: payload.partitionId
        } satisfies NormalizeVariantPayload)
      )
    );

    return { source: payload.source, candidates: candidates.length };
  }

  async handleReconcileVariant(payload: NormalizeVariantPayload) {
    const connector = getConnector(payload.source);
    const normalized = await connector.normalize(payload.candidate);

    if (!normalized) {
      if (payload.seed.seedKind === "detail_refresh" && payload.seed.refreshVariantId) {
        await this.markVariantRefreshMiss(payload.seed.refreshVariantId);
      }
      await this.markRunProgress(
        payload.runId,
        payload.rawSnapshotId,
        payload.expectedTotal,
        false,
        payload.finalizeRunOnComplete ?? true
      );
      return { source: payload.source, normalized: false };
    }

    if (await this.isBlacklisted(payload.source, normalized.sourceUrl, normalized.sourceListingId)) {
      if (payload.seed.seedKind === "detail_refresh" && payload.seed.refreshVariantId) {
        await this.markVariantBlocked(payload.seed.refreshVariantId);
      }
      await this.markRunProgress(
        payload.runId,
        payload.rawSnapshotId,
        payload.expectedTotal,
        true,
        payload.finalizeRunOnComplete ?? true
      );
      return {
        source: payload.source,
        normalized: false,
        skipped: true,
        sourceListingId: normalized.sourceListingId
      };
    }

    const enrichment = this.buildNormalizedEnrichment(normalized);
    const areaRecord = await this.upsertAreaRecord(enrichment.area);

    const variant = await this.prisma.listingVariant.upsert({
      where: {
        source_sourceListingId: {
          source: toPrismaSource(normalized.source),
          sourceListingId: normalized.sourceListingId
        }
      },
      update: {
        rawSnapshotId: payload.rawSnapshotId,
        canonicalUrl: normalized.sourceUrl,
        titleEn: normalized.title.en,
        titleAr: normalized.title.ar,
        descriptionEn: normalized.description.en,
        descriptionAr: normalized.description.ar,
        purpose: toPrismaPurpose(normalized.purpose),
        marketSegment: toPrismaMarketSegment(normalized.marketSegment),
        propertyType: normalized.propertyType,
        publishedAt: normalized.publishedAt ? new Date(normalized.publishedAt) : null,
        extractionConfidence: normalized.extractionConfidence,
        rawFields: enrichment.persistedRawFields,
        imageUrls: normalized.imageUrls,
        lastSeenAt: new Date(),
        lastCrawledAt: new Date(),
        refreshMissCount: 0,
        sourceStatus: PrismaSourceListingStatus.ACTIVE,
        inactiveAt: null
      },
      create: {
        rawSnapshotId: payload.rawSnapshotId,
        source: toPrismaSource(normalized.source),
        sourceListingId: normalized.sourceListingId,
        canonicalUrl: normalized.sourceUrl,
        titleEn: normalized.title.en,
        titleAr: normalized.title.ar,
        descriptionEn: normalized.description.en,
        descriptionAr: normalized.description.ar,
        purpose: toPrismaPurpose(normalized.purpose),
        marketSegment: toPrismaMarketSegment(normalized.marketSegment),
        propertyType: normalized.propertyType,
        publishedAt: normalized.publishedAt ? new Date(normalized.publishedAt) : null,
        extractionConfidence: normalized.extractionConfidence,
        rawFields: enrichment.persistedRawFields,
        imageUrls: normalized.imageUrls,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        lastCrawledAt: new Date(),
        refreshMissCount: 0,
        sourceStatus: PrismaSourceListingStatus.ACTIVE
      }
    });

    if (payload.partitionId) {
      await this.prisma.sourcePartitionListing.updateMany({
        where: {
          partitionId: payload.partitionId,
          sourceListingId: normalized.sourceListingId
        },
        data: {
          variantId: variant.id,
          lastSeenAt: new Date(),
          lastSweepToken: payload.seed.sweepToken ?? undefined,
          missCount: 0
        }
      });
    }

    const clusterSync = await this.syncClusterForVariant(variant.id, normalized, areaRecord?.id ?? null);
    await this.syncProjectForCluster(clusterSync.clusterId, normalized, areaRecord?.id ?? null);
    await this.persistPriceHistory(variant.id, clusterSync.clusterId, normalized.price);
    await this.markRunProgress(
      payload.runId,
      payload.rawSnapshotId,
      payload.expectedTotal,
      true,
      payload.finalizeRunOnComplete ?? true
    );

    if (clusterSync.eventType) {
      await this.queues["score-cluster"].add(`score-cluster:${payload.source}:${clusterSync.clusterId}:${Date.now()}`, {
        source: payload.source,
        runId: payload.runId,
        stage: "score-cluster",
        clusterId: clusterSync.clusterId,
        eventType: clusterSync.eventType
      } satisfies PipelineStagePayload);
    }

    return {
      source: payload.source,
      normalized: true,
      sourceListingId: normalized.sourceListingId,
      clusterId: clusterSync.clusterId,
      eventType: clusterSync.eventType
    };
  }

  async handleNormalizeVariant(payload: NormalizeVariantPayload) {
    return this.handleReconcileVariant(payload);
  }

  async handleNoopStage(payload: PipelineStagePayload) {
    if (payload.stage === "score-cluster" && payload.clusterId) {
      await this.queues["score-fraud"].add(`score-fraud:${payload.clusterId}:${Date.now()}`, {
        source: payload.source,
        runId: payload.runId,
        stage: "score-fraud",
        clusterId: payload.clusterId,
        eventType: payload.eventType
      } satisfies PipelineStagePayload);

      return { source: payload.source, stage: payload.stage, status: "queued" };
    }

    if (payload.stage === "score-fraud" && payload.clusterId) {
      await this.scoreClusterFraud(payload.clusterId);
      await this.queues["match-alerts"].add(`match-alerts:${payload.clusterId}:${Date.now()}`, {
        source: payload.source,
        runId: payload.runId,
        stage: "match-alerts",
        clusterId: payload.clusterId,
        eventType: payload.eventType
      } satisfies PipelineStagePayload);

      return { source: payload.source, stage: payload.stage, status: "queued" };
    }

    if (payload.stage === "match-alerts" && payload.clusterId && payload.eventType) {
      const notificationIds = await this.matchAlerts(payload.clusterId, payload.eventType);

      if (notificationIds.length > 0) {
        await this.queues["send-notification"].add(`send-notification:${payload.clusterId}:${Date.now()}`, {
          source: payload.source,
          runId: payload.runId,
          stage: "send-notification",
          clusterId: payload.clusterId,
          eventType: payload.eventType,
          notificationIds
        } satisfies PipelineStagePayload);
      }

      return { source: payload.source, stage: payload.stage, notifications: notificationIds.length };
    }

    if (payload.stage === "send-notification" && payload.notificationIds) {
      await this.createDeliveryLogs(payload.notificationIds);
      return { source: payload.source, stage: payload.stage, deliveries: payload.notificationIds.length };
    }

    return { source: payload.source, stage: payload.stage, status: "noop" };
  }

  async replayRawSnapshot(snapshotId: string) {
    const snapshot = await this.prisma.rawSnapshot.findUniqueOrThrow({
      where: { id: snapshotId }
    });
    const body = await this.storage.getObject(snapshot.storageKey);
    const source = this.fromPrismaSource(snapshot.source);
    const connector = getConnector(source);
    const parsed = await connector.parse({
      source,
      url: snapshot.sourceUrl,
      sourceListingId: snapshot.sourceListingId ?? undefined,
      payloadType: snapshot.payloadType as "html" | "json",
      body,
      fetchedAt: snapshot.fetchedAt.toISOString()
    });

    return Promise.all(parsed.map((candidate) => connector.normalize(candidate)));
  }

  async backfillExistingVariants(options: { limit?: number; recluster?: boolean } = {}) {
    const variants = await this.prisma.listingVariant.findMany({
      where: options.recluster
        ? undefined
        : {
            OR: [
              { clusterId: null },
              { priceHistory: { some: { clusterId: null } } },
              {
                marketSegment: PrismaMarketSegment.OFF_PLAN,
                cluster: {
                  is: {
                    projectId: null
                  }
                }
              }
            ]
          },
      include: {
        priceHistory: {
          orderBy: {
            recordedAt: "desc"
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      },
      ...(options.limit ? { take: options.limit } : {})
    });

    const touchedClusters = new Set<string>();
    const summary = {
      scannedVariants: variants.length,
      backfilledClusters: 0,
      skippedVariants: 0,
      repairedPriceHistoryRows: 0,
      createdPriceHistoryRows: 0,
      scoredClusters: 0,
      createdProjects: 0,
      linkedProjectClusters: 0,
      reviewEdges: 0,
      autoAttachedVariants: 0,
      collapsedClusters: 0
    };

    for (const variant of variants) {
      const normalized = this.rehydrateNormalizedCandidate(variant);

      if (!normalized) {
        summary.skippedVariants += 1;
        continue;
      }

      const areaId = await this.refreshVariantNormalization(variant.id, normalized);
      const clusterSync =
        variant.clusterId !== null && !options.recluster
          ? {
              clusterId: variant.clusterId,
              eventType: undefined,
              reviewEdgeCount: 0,
              autoAttached: false,
              collapsedCluster: false
            }
          : await this.syncClusterForVariant(variant.id, normalized, areaId);
      const projectSync = await this.syncProjectForCluster(clusterSync.clusterId, normalized, areaId);

      if (clusterSync.eventType === "new_listing") {
        summary.backfilledClusters += 1;
      }

      summary.reviewEdges += clusterSync.reviewEdgeCount;

      if (clusterSync.autoAttached) {
        summary.autoAttachedVariants += 1;
      }

      if (clusterSync.collapsedCluster) {
        summary.collapsedClusters += 1;
      }

      if (projectSync.createdProject) {
        summary.createdProjects += 1;
      }

      if (projectSync.linkedCluster) {
        summary.linkedProjectClusters += 1;
      }

      const priceHistoryResult = await this.persistPriceHistory(variant.id, clusterSync.clusterId, normalized.price);
      summary.repairedPriceHistoryRows += priceHistoryResult.updatedCount;
      summary.createdPriceHistoryRows += priceHistoryResult.created ? 1 : 0;

      if (!touchedClusters.has(clusterSync.clusterId)) {
        await this.scoreClusterFraud(clusterSync.clusterId);
        touchedClusters.add(clusterSync.clusterId);
      }
    }

    return {
      ...summary,
      scoredClusters: touchedClusters.size
    };
  }

  async markRunFailed(runId: string | undefined, _message: string, partitionId?: string, refreshVariantId?: string) {
    if (!runId) {
      return;
    }

    await this.prisma.ingestionRun.updateMany({
      where: { id: runId },
      data: {
        status: "failed",
        failedCount: {
          increment: 1
        },
        completedAt: new Date()
      }
    });

    if (partitionId) {
      await this.markPartitionFailure(partitionId);
    }

    if (refreshVariantId) {
      await this.markVariantRefreshMiss(refreshVariantId);
    }

    await this.syncParserDriftAlarm(runId);
  }

  private async persistPriceHistory(variantId: string, clusterId: string, price: NormalizedListingCandidate["price"]) {
    const updated = await this.prisma.priceHistory.updateMany({
      where: {
        variantId,
        clusterId: null
      },
      data: {
        clusterId
      }
    });

    const existingLatest = await this.prisma.priceHistory.findFirst({
      where: {
        variantId
      },
      orderBy: {
        recordedAt: "desc"
      }
    });

    if (existingLatest?.price === price.amount && existingLatest.currency === price.currency) {
      return {
        updatedCount: updated.count,
        created: false
      };
    }

    await this.prisma.priceHistory.create({
      data: {
        clusterId,
        variantId,
        price: price.amount,
        currency: price.currency
      }
    });

    return {
      updatedCount: updated.count,
      created: true
    };
  }

  private async syncClusterForVariant(
    variantId: string,
    normalized: NormalizedListingCandidate,
    areaId: string | null
  ): Promise<ClusterSyncResult> {
    const variant = await this.prisma.listingVariant.findUniqueOrThrow({
      where: { id: variantId }
    });
    const existingClusterId = variant.clusterId;
    const dedup = await this.findDuplicateClusterForVariant(variantId, normalized);

    if (!existingClusterId && dedup.autoAttachClusterId) {
      const targetCluster = await this.prisma.listingCluster.findUniqueOrThrow({
        where: { id: dedup.autoAttachClusterId }
      });

      await this.attachVariantToCluster(variantId, targetCluster.id);
      await this.refreshClusterSummary(targetCluster.id);

      return {
        clusterId: targetCluster.id,
        eventType:
          targetCluster.bestPrice !== null && normalized.price.amount < targetCluster.bestPrice ? "price_drop" : undefined,
        reviewEdgeCount: dedup.reviewEdgeCount,
        autoAttached: true,
        collapsedCluster: false
      };
    }

    if (!existingClusterId) {
      const cluster = await this.prisma.listingCluster.create({
        data: {
          canonicalTitleEn: normalized.title.en,
          canonicalTitleAr: normalized.title.ar,
          purpose: toPrismaPurpose(normalized.purpose),
          marketSegment: toPrismaMarketSegment(normalized.marketSegment),
          propertyType: normalized.propertyType,
          areaId: areaId ?? undefined,
          bedrooms: normalized.bedrooms,
          bathrooms: normalized.bathrooms,
          areaSqm: normalized.areaSqm,
          bestPrice: normalized.price.amount,
          currency: normalized.price.currency,
          fraudLabel: PrismaFraudLabel.SAFE,
          fraudScore: 0.08
        }
      });

      await this.attachVariantToCluster(variantId, cluster.id);

      return {
        clusterId: cluster.id,
        eventType: "new_listing",
        reviewEdgeCount: dedup.reviewEdgeCount,
        autoAttached: false,
        collapsedCluster: false
      };
    }

    const currentCluster = await this.prisma.listingCluster.findUniqueOrThrow({
      where: { id: existingClusterId }
    });

    if (dedup.autoAttachClusterId && dedup.autoAttachClusterId !== currentCluster.id) {
      const targetCluster = await this.prisma.listingCluster.findUniqueOrThrow({
        where: { id: dedup.autoAttachClusterId }
      });
      await this.attachVariantToCluster(variantId, dedup.autoAttachClusterId);
      const collapsedCluster = await this.absorbSourceClusterIfEmpty(currentCluster.id, dedup.autoAttachClusterId);
      await this.refreshClusterSummary(dedup.autoAttachClusterId);

      return {
        clusterId: dedup.autoAttachClusterId,
        eventType:
          targetCluster.bestPrice !== null && normalized.price.amount < targetCluster.bestPrice ? "price_drop" : undefined,
        reviewEdgeCount: dedup.reviewEdgeCount,
        autoAttached: true,
        collapsedCluster
      };
    }

    await this.prisma.listingCluster.update({
      where: { id: currentCluster.id },
      data: {
        canonicalTitleEn: normalized.title.en,
        canonicalTitleAr: normalized.title.ar,
        areaId: areaId ?? currentCluster.areaId ?? undefined,
        bedrooms: normalized.bedrooms ?? currentCluster.bedrooms,
        bathrooms: normalized.bathrooms ?? currentCluster.bathrooms,
        areaSqm: normalized.areaSqm ?? currentCluster.areaSqm,
        bestPrice:
          currentCluster.bestPrice !== null
            ? Math.min(currentCluster.bestPrice, normalized.price.amount)
            : normalized.price.amount
      }
    });

    return {
      clusterId: currentCluster.id,
      eventType:
        currentCluster.bestPrice !== null && normalized.price.amount < currentCluster.bestPrice ? "price_drop" : undefined,
      reviewEdgeCount: dedup.reviewEdgeCount,
      autoAttached: false,
      collapsedCluster: false
    };
  }

  private async findDuplicateClusterForVariant(variantId: string, normalized: NormalizedListingCandidate) {
    await this.prisma.clusterEdge.deleteMany({
      where: {
        OR: [{ leftVariantId: variantId }, { rightVariantId: variantId }]
      }
    });

    const candidates = await this.prisma.listingVariant.findMany({
      where: {
        id: {
          not: variantId
        },
        clusterId: {
          not: null
        },
        purpose: toPrismaPurpose(normalized.purpose),
        marketSegment: toPrismaMarketSegment(normalized.marketSegment),
        propertyType: normalized.propertyType
      },
      include: {
        priceHistory: {
          orderBy: {
            recordedAt: "desc"
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 200
    });

    const input = this.buildComparableListingFromNormalized(variantId, normalized);
    const matches = candidates
      .map((candidate) => {
        const comparable = this.buildComparableListingFromVariant(candidate);
        const score = scoreDuplicateCandidate(input, comparable);

        return {
          candidate,
          score
        };
      })
      .filter((entry) => entry.score.score >= REVIEW_EDGE_THRESHOLD)
      .sort((left, right) => right.score.score - left.score.score);

    for (const match of matches) {
      const [leftVariantId, rightVariantId] = [variantId, match.candidate.id].sort((left, right) => left.localeCompare(right));
      await this.prisma.clusterEdge.upsert({
        where: {
          leftVariantId_rightVariantId: {
            leftVariantId,
            rightVariantId
          }
        },
        update: {
          score: match.score.score,
          reasons: {
            decision: match.score.decision,
            reasons: match.score.reasons
          }
        },
        create: {
          leftVariantId,
          rightVariantId,
          score: match.score.score,
          reasons: {
            decision: match.score.decision,
            reasons: match.score.reasons
          }
        }
      });
    }

    const bestMatch = matches[0];

    return {
      autoAttachClusterId:
        bestMatch && bestMatch.score.score >= AUTO_ATTACH_EDGE_THRESHOLD ? (bestMatch.candidate.clusterId ?? null) : null,
      reviewEdgeCount: matches.length
    };
  }

  private async attachVariantToCluster(variantId: string, clusterId: string) {
    await this.prisma.$transaction([
      this.prisma.listingVariant.update({
        where: { id: variantId },
        data: {
          clusterId
        }
      }),
      this.prisma.priceHistory.updateMany({
        where: { variantId },
        data: {
          clusterId
        }
      })
    ]);
  }

  private async absorbSourceClusterIfEmpty(sourceClusterId: string, targetClusterId: string) {
    const sourceCluster = await this.prisma.listingCluster.findUnique({
      where: { id: sourceClusterId },
      include: {
        variants: {
          select: { id: true }
        }
      }
    });

    if (!sourceCluster) {
      return false;
    }

    if (sourceCluster.variants.length > 0) {
      await this.refreshClusterSummary(sourceClusterId);
      return false;
    }

    const sourceFavoriteUserIds = await this.prisma.favorite.findMany({
      where: { clusterId: sourceClusterId },
      select: { userId: true }
    });

    const duplicateTargetFavorites = await this.prisma.favorite.findMany({
      where: {
        clusterId: targetClusterId,
        userId: {
          in: sourceFavoriteUserIds.map((entry) => entry.userId)
        }
      },
      select: { userId: true }
    });

    await this.prisma.$transaction(async (tx) => {
      if (duplicateTargetFavorites.length > 0) {
        await tx.favorite.deleteMany({
          where: {
            clusterId: sourceClusterId,
            userId: {
              in: duplicateTargetFavorites.map((entry) => entry.userId)
            }
          }
        });
      }

      await Promise.all([
        tx.favorite.updateMany({
          where: { clusterId: sourceClusterId },
          data: { clusterId: targetClusterId }
        }),
        tx.notification.updateMany({
          where: { clusterId: sourceClusterId },
          data: { clusterId: targetClusterId }
        }),
        tx.report.updateMany({
          where: { clusterId: sourceClusterId },
          data: { clusterId: targetClusterId }
        }),
        tx.fraudCase.updateMany({
          where: { clusterId: sourceClusterId },
          data: { clusterId: targetClusterId }
        }),
        tx.priceHistory.updateMany({
          where: { clusterId: sourceClusterId },
          data: { clusterId: targetClusterId }
        }),
        tx.listingCluster.delete({
          where: { id: sourceClusterId }
        })
      ]);
    });

    return true;
  }

  private async refreshClusterSummary(clusterId: string) {
    const cluster = await this.prisma.listingCluster.findUnique({
      where: { id: clusterId },
      include: {
        variants: {
          include: {
            priceHistory: {
              orderBy: {
                recordedAt: "desc"
              }
            }
          },
          orderBy: [{ extractionConfidence: "desc" }, { updatedAt: "desc" }]
        }
      }
    });

    if (!cluster || cluster.variants.length === 0) {
      return;
    }

    const primaryVariant = cluster.variants[0];
    const summary = this.extractVariantSummary(primaryVariant);
    const rawFields = asRecord(primaryVariant.rawFields);
    const area = asRecord(rawFields?.area);
    const areaSlug = asString(area?.slug);
    const bestPrice = await this.getBestPriceForVariants(
      cluster.variants.map((variant) => variant.id),
      cluster.bestPrice
    );
    const nextArea = areaSlug ? await this.prisma.area.findUnique({ where: { slug: areaSlug } }) : null;

    await this.prisma.listingCluster.update({
      where: { id: cluster.id },
      data: {
        canonicalTitleEn: primaryVariant.titleEn,
        canonicalTitleAr: primaryVariant.titleAr,
        purpose: primaryVariant.purpose,
        marketSegment: primaryVariant.marketSegment,
        propertyType: primaryVariant.propertyType,
        areaId: nextArea?.id ?? cluster.areaId ?? undefined,
        bedrooms: summary.bedrooms ?? cluster.bedrooms,
        bathrooms: summary.bathrooms ?? cluster.bathrooms,
        areaSqm: summary.areaSqm ?? cluster.areaSqm,
        bestPrice,
        currency: primaryVariant.priceHistory[0]?.currency ?? cluster.currency
      }
    });
  }

  private buildComparableListingFromNormalized(
    variantId: string,
    normalized: NormalizedListingCandidate
  ): DedupComparableListing {
    const area = normalizeArea(normalized.areaName, [
      normalized.areaName ?? "",
      normalized.compoundName?.en ?? "",
      normalized.developerName?.en ?? ""
    ]);

    return {
      variantId,
      source: normalized.source,
      sourceListingId: normalized.sourceListingId,
      canonicalUrl: normalized.sourceUrl,
      purpose: normalized.purpose,
      marketSegment: normalized.marketSegment,
      propertyType: normalized.propertyType,
      priceAmount: normalized.price.amount,
      bedrooms: normalized.bedrooms ?? null,
      bathrooms: normalized.bathrooms ?? null,
      areaSqm: normalized.areaSqm ?? null,
      areaSlug: area?.slug ?? null,
      titleEn: normalized.title.en,
      titleAr: normalized.title.ar,
      compoundName: normalized.compoundName?.en ?? null,
      developerName: normalized.developerName?.en ?? null,
      coordinates: normalized.location ?? null,
      mediaHashes: normalized.mediaHashes
    };
  }

  private buildComparableListingFromVariant(variant: PersistedVariantRecord): DedupComparableListing {
    const rawFields = asRecord(variant.rawFields);
    const normalizedSummary = asRecord(rawFields?.normalized);
    const area = asRecord(rawFields?.area);

    return {
      variantId: variant.id,
      clusterId: variant.clusterId,
      source: this.fromPrismaSource(variant.source),
      sourceListingId: variant.sourceListingId,
      canonicalUrl: variant.canonicalUrl,
      purpose: this.fromPrismaPurpose(variant.purpose),
      marketSegment: this.fromPrismaMarketSegment(variant.marketSegment),
      propertyType: variant.propertyType,
      priceAmount: this.resolveVariantPrice(variant, asRecord(rawFields?.sourcePayload), normalizedSummary)?.amount ?? 0,
      bedrooms: asNumber(normalizedSummary?.bedrooms) ?? null,
      bathrooms: asNumber(normalizedSummary?.bathrooms) ?? null,
      areaSqm: asNumber(normalizedSummary?.areaSqm) ?? null,
      areaSlug: asString(area?.slug) ?? null,
      titleEn: variant.titleEn,
      titleAr: variant.titleAr,
      compoundName: asString(asRecord(normalizedSummary?.compoundName)?.en) ?? null,
      developerName: asString(asRecord(normalizedSummary?.developerName)?.en) ?? null,
      coordinates: asCoordinates(normalizedSummary?.location) ?? asCoordinates(rawFields?.geocodedLocation) ?? null,
      mediaHashes: asStringArray(rawFields?.mediaHashes)
    };
  }

  private async scoreClusterFraud(clusterId: string) {
    const cluster = await this.prisma.listingCluster.findUniqueOrThrow({
      where: { id: clusterId },
      include: {
        variants: true
      }
    });
    const variantCount = cluster.variants.length;
    const lowPriceSignal = cluster.bestPrice && cluster.bestPrice < 10000 ? 0.45 : 0.04;
    const score = Number(Math.min(0.15 + lowPriceSignal + variantCount * 0.03, 0.82).toFixed(3));
    const label =
      score >= 0.8 ? PrismaFraudLabel.HIGH_RISK : score >= 0.35 ? PrismaFraudLabel.REVIEW : PrismaFraudLabel.SAFE;
    const explanation =
      label === PrismaFraudLabel.HIGH_RISK
        ? ["Cluster crossed the high-risk fraud threshold.", "Price is significantly below the current heuristic baseline."]
        : label === PrismaFraudLabel.REVIEW
          ? ["Cluster flagged for manual review based on pricing or duplication heuristics."]
          : ["Cluster is currently within the safe heuristic band."];

    await this.prisma.listingCluster.update({
      where: { id: clusterId },
      data: {
        fraudLabel: label,
        fraudScore: score
      }
    });

    if (label === PrismaFraudLabel.SAFE) {
      await this.prisma.fraudCase.updateMany({
        where: {
          clusterId,
          resolvedAt: null
        },
        data: {
          resolvedAt: new Date()
        }
      });
      return;
    }

    const existingOpenCase = await this.prisma.fraudCase.findFirst({
      where: {
        clusterId,
        resolvedAt: null
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (existingOpenCase) {
      await this.prisma.fraudCase.update({
        where: { id: existingOpenCase.id },
        data: {
          label,
          score,
          explanation
        }
      });
      return;
    }

    await this.prisma.fraudCase.create({
      data: {
        clusterId,
        label,
        score,
        explanation
      }
    });
  }

  private async matchAlerts(clusterId: string, eventType: "new_listing" | "price_drop") {
    const cluster = await this.prisma.listingCluster.findUniqueOrThrow({
      where: { id: clusterId },
      include: {
        area: true,
        variants: true
      }
    });

    const alerts = await this.prisma.alert.findMany({
      include: {
        user: {
          include: {
            pushSubscriptions: true
          }
        }
      }
    });
    const notificationIds: string[] = [];

    for (const alert of alerts) {
      if (!this.matchesAlertFilters(cluster, (alert.filters ?? {}) as AlertFilterRecord)) {
        continue;
      }

      const title =
        eventType === "price_drop"
          ? `Price drop in ${cluster.area?.nameEn ?? "saved area"}`
          : `New match in ${cluster.area?.nameEn ?? "saved area"}`;
      const body =
        eventType === "price_drop"
          ? `${cluster.canonicalTitleEn} is now available from EGP ${cluster.bestPrice ?? 0}.`
          : `${cluster.canonicalTitleEn} matched your alert ${alert.name}.`;
      const dedupeKey =
        eventType === "price_drop"
          ? `${eventType}:${alert.id}:${cluster.id}:${cluster.bestPrice ?? "na"}`
          : `${eventType}:${alert.id}:${cluster.id}`;

      const notification = await this.prisma.notification.upsert({
        where: { dedupeKey },
        update: {
          title,
          body,
          metadata: {
            eventType,
            bestPrice: cluster.bestPrice,
            variantCount: cluster.variants.length
          }
        },
        create: {
          userId: alert.userId,
          alertId: alert.id,
          clusterId: cluster.id,
          type: eventType,
          title,
          body,
          dedupeKey,
          metadata: {
            eventType,
            bestPrice: cluster.bestPrice,
            variantCount: cluster.variants.length
          }
        }
      });

      notificationIds.push(notification.id);
    }

    return notificationIds;
  }

  private matchesAlertFilters(
    cluster: {
      purpose: PrismaListingPurpose;
      marketSegment: PrismaMarketSegment;
      propertyType: string;
      bedrooms: number | null;
      bathrooms: number | null;
      bestPrice: number | null;
      areaSqm: number | null;
      canonicalTitleEn: string;
      canonicalTitleAr: string;
      area: { slug: string; nameEn: string; nameAr: string } | null;
    },
    filters: AlertFilterRecord
  ) {
    const areaIds = Array.isArray(filters.areaIds) ? filters.areaIds.filter((value): value is string => typeof value === "string") : [];
    const bedrooms = Array.isArray(filters.bedrooms)
      ? filters.bedrooms.filter((value): value is number => typeof value === "number")
      : [];
    const bathrooms = Array.isArray(filters.bathrooms)
      ? filters.bathrooms.filter((value): value is number => typeof value === "number")
      : [];
    const propertyTypes = Array.isArray(filters.propertyTypes)
      ? filters.propertyTypes.filter((value): value is string => typeof value === "string")
      : [];
    const query = typeof filters.query === "string" ? filters.query.trim().toLowerCase() : "";

    if (typeof filters.purpose === "string" && filters.purpose.toUpperCase() !== cluster.purpose) {
      return false;
    }

    if (typeof filters.marketSegment === "string" && filters.marketSegment.toUpperCase() !== cluster.marketSegment) {
      return false;
    }

    if (areaIds.length > 0 && (!cluster.area || !areaIds.includes(cluster.area.slug))) {
      return false;
    }

    if (propertyTypes.length > 0 && !propertyTypes.includes(cluster.propertyType)) {
      return false;
    }

    if (bedrooms.length > 0 && (cluster.bedrooms === null || !bedrooms.includes(cluster.bedrooms))) {
      return false;
    }

    if (bathrooms.length > 0 && (cluster.bathrooms === null || !bathrooms.includes(cluster.bathrooms))) {
      return false;
    }

    if (typeof filters.minPrice === "number" && (cluster.bestPrice === null || cluster.bestPrice < filters.minPrice)) {
      return false;
    }

    if (typeof filters.maxPrice === "number" && (cluster.bestPrice === null || cluster.bestPrice > filters.maxPrice)) {
      return false;
    }

    if (typeof filters.minAreaSqm === "number" && (cluster.areaSqm === null || cluster.areaSqm < filters.minAreaSqm)) {
      return false;
    }

    if (typeof filters.maxAreaSqm === "number" && (cluster.areaSqm === null || cluster.areaSqm > filters.maxAreaSqm)) {
      return false;
    }

    if (query) {
      const haystack = [cluster.canonicalTitleEn, cluster.canonicalTitleAr, cluster.area?.nameEn, cluster.area?.nameAr]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(query)) {
        return false;
      }
    }

    return true;
  }

  private async createDeliveryLogs(notificationIds: string[]) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        id: {
          in: notificationIds
        }
      },
      include: {
        alert: true,
        user: {
          include: {
            pushSubscriptions: true
          }
        },
        deliveries: true
      }
    });

    for (const notification of notifications) {
      if (notification.deliveries.length > 0) {
        continue;
      }

      const prefs = (notification.user.notificationPrefs ?? {}) as {
        emailEnabled?: boolean;
        pushEnabled?: boolean;
      };
      const inQuietHours = isWithinQuietHours(notification.alert?.quietHoursStart, notification.alert?.quietHoursEnd);
      const rows: Prisma.NotificationDeliveryCreateManyInput[] = [
        {
          notificationId: notification.id,
          channel: "inbox",
          status: "delivered",
          deliveredAt: new Date(),
          metadata: {
            reason: "stored_in_inbox"
          }
        },
        {
          notificationId: notification.id,
          channel: "email",
          status:
            notification.alert?.notifyByEmail && prefs.emailEnabled !== false && !inQuietHours ? "queued" : "skipped",
          attemptedAt: new Date(),
          metadata: {
            quietHours: inQuietHours,
            enabled: notification.alert?.notifyByEmail ?? false,
            userPrefEnabled: prefs.emailEnabled !== false,
            provider: "ses"
          }
        },
        {
          notificationId: notification.id,
          channel: "push",
          status:
            notification.alert?.notifyByPush &&
            prefs.pushEnabled !== false &&
            notification.user.pushSubscriptions.length > 0 &&
            !inQuietHours
              ? "queued"
              : "skipped",
          attemptedAt: new Date(),
          metadata: {
            quietHours: inQuietHours,
            enabled: notification.alert?.notifyByPush ?? false,
            userPrefEnabled: prefs.pushEnabled !== false,
            subscriptionCount: notification.user.pushSubscriptions.length,
            provider: "web-push"
          }
        }
      ];

      await this.prisma.notificationDelivery.createMany({
        data: rows
      });
    }
  }

  private async persistRawSnapshot(source: ListingSource, runId: string, seed: SourceSeed, raw: RawPageResult) {
    await this.storage.ensureBucket();

    const storageKey = buildStorageKey(source, runId, seed.label, raw.payloadType);
    await this.storage.putObject(
      storageKey,
      raw.body,
      raw.payloadType === "json" ? "application/json" : "text/html; charset=utf-8"
    );

    return this.prisma.rawSnapshot.create({
      data: {
        source: toPrismaSource(source),
        sourceListingId: raw.sourceListingId,
        sourceUrl: raw.url,
        payloadType: raw.payloadType,
        storageKey,
        parserVersion: "phase-6",
        fetchedAt: new Date(raw.fetchedAt)
      }
    });
  }

  private async parseCandidates(source: ListingSource, rawSnapshotId: string, seed: SourceSeed) {
    const connector = getConnector(source);
    const snapshot = await this.prisma.rawSnapshot.findUniqueOrThrow({
      where: { id: rawSnapshotId }
    });
    const body = await this.storage.getObject(snapshot.storageKey);
    const raw: RawPageResult = {
      source,
      url: snapshot.sourceUrl,
      sourceListingId: snapshot.sourceListingId ?? seed.sourceListingId ?? undefined,
      payloadType: snapshot.payloadType as "html" | "json",
      body,
      fetchedAt: snapshot.fetchedAt.toISOString()
    };
    const parsedCandidates = await connector.parse(raw);
    const candidates: ParsedListingCandidate[] = [];

    for (const candidate of parsedCandidates) {
      if (await this.isBlacklisted(source, candidate.sourceUrl, candidate.sourceListingId)) {
        continue;
      }

      candidates.push(candidate);
    }

    return candidates;
  }

  private async recordPartitionSeenListings(
    partitionId: string,
    source: ListingSource,
    sweepToken: string,
    candidates: ParsedListingCandidate[]
  ) {
    const sourceListingIds = [...new Set(candidates.map((candidate) => candidate.sourceListingId).filter(Boolean))] as string[];

    if (sourceListingIds.length === 0) {
      return;
    }

    const existingVariants = await this.prisma.listingVariant.findMany({
      where: {
        source: toPrismaSource(source),
        sourceListingId: {
          in: sourceListingIds
        }
      },
      select: {
        id: true,
        sourceListingId: true
      }
    });
    const variantIdBySourceListingId = new Map(
      existingVariants.map((variant) => [variant.sourceListingId, variant.id] as const)
    );
    const now = new Date();

    await Promise.all(
      sourceListingIds.map((sourceListingId) =>
        this.prisma.sourcePartitionListing.upsert({
          where: {
            partitionId_sourceListingId: {
              partitionId,
              sourceListingId
            }
          },
          update: {
            variantId: variantIdBySourceListingId.get(sourceListingId),
            lastSweepToken: sweepToken,
            missCount: 0,
            lastSeenAt: now
          },
          create: {
            partitionId,
            variantId: variantIdBySourceListingId.get(sourceListingId),
            sourceListingId,
            lastSweepToken: sweepToken,
            missCount: 0,
            firstSeenAt: now,
            lastSeenAt: now
          }
        })
      )
    );
  }

  private async updatePartitionDiscoveryState(
    partitionId: string,
    page: number,
    pageSignature?: string | null,
    stopReason?: string | null,
    completed = false
  ) {
    const partition = await this.prisma.sourcePartition.findUnique({
      where: { id: partitionId }
    });

    if (!partition) {
      return;
    }

    const now = new Date();
    await this.prisma.sourcePartition.update({
      where: { id: partitionId },
      data: {
        lastPageCrawled: page,
        lastDiscoverySignature: pageSignature ?? null,
        stopReason: stopReason ?? null,
        ...(completed
          ? {
              lastCrawledAt: now,
              nextCrawlAt: getNextPartitionCrawlAt(partition.priority, now),
              failureCount: 0
            }
          : {})
      }
    });
  }

  private async reconcilePartitionMisses(partitionId: string, sweepToken: string) {
    const unseenRows = await this.prisma.sourcePartitionListing.findMany({
      where: {
        partitionId,
        OR: [{ lastSweepToken: null }, { lastSweepToken: { not: sweepToken } }]
      },
      select: {
        id: true,
        variantId: true,
        missCount: true
      }
    });

    if (unseenRows.length === 0) {
      return;
    }

    const now = new Date();
    const missThreshold = Number(process.env.CRAWLER_PARTITION_MISS_THRESHOLD ?? "2");
    const membershipIds = unseenRows.map((row) => row.id);

    await this.prisma.sourcePartitionListing.updateMany({
      where: {
        id: {
          in: membershipIds
        }
      },
      data: {
        missCount: {
          increment: 1
        }
      }
    });

    const missingVariantIds = unseenRows
      .filter((row) => row.variantId && row.missCount + 1 < missThreshold)
      .map((row) => row.variantId as string);
    const removedVariantIds = unseenRows
      .filter((row) => row.variantId && row.missCount + 1 >= missThreshold)
      .map((row) => row.variantId as string);

    if (missingVariantIds.length > 0) {
      await this.prisma.listingVariant.updateMany({
        where: {
          id: {
            in: missingVariantIds
          },
          sourceStatus: {
            not: PrismaSourceListingStatus.BLOCKED
          }
        },
        data: {
          sourceStatus: PrismaSourceListingStatus.MISSING,
          lastCrawledAt: now
        }
      });
    }

    if (removedVariantIds.length > 0) {
      await this.prisma.listingVariant.updateMany({
        where: {
          id: {
            in: removedVariantIds
          },
          sourceStatus: {
            not: PrismaSourceListingStatus.BLOCKED
          }
        },
        data: {
          sourceStatus: PrismaSourceListingStatus.REMOVED,
          inactiveAt: now,
          lastCrawledAt: now
        }
      });
    }
  }

  private async markVariantBlocked(variantId: string) {
    await this.prisma.listingVariant.updateMany({
      where: {
        id: variantId
      },
      data: {
        sourceStatus: PrismaSourceListingStatus.BLOCKED,
        inactiveAt: new Date(),
        lastCrawledAt: new Date()
      }
    });
  }

  private async touchPartitionSuccess(partitionId: string) {
    const now = new Date();
    const partition = await this.prisma.sourcePartition.findUnique({
      where: { id: partitionId }
    });

    if (!partition) {
      return;
    }

    await this.prisma.sourcePartition.update({
      where: { id: partitionId },
      data: {
        lastCrawledAt: now,
        nextCrawlAt: getNextPartitionCrawlAt(partition.priority, now),
        failureCount: 0,
        stopReason: null
      }
    });
  }

  private async markPartitionFailure(partitionId: string) {
    const partition = await this.prisma.sourcePartition.findUnique({
      where: { id: partitionId }
    });

    if (!partition) {
      return;
    }

    const failures = partition.failureCount + 1;
    const backoffMinutes = Math.min(12 * 60, 15 * failures);
    await this.prisma.sourcePartition.update({
      where: { id: partitionId },
      data: {
        failureCount: failures,
        nextCrawlAt: new Date(Date.now() + backoffMinutes * 60_000),
        stopReason: "partition_failure"
      }
    });
  }

  private async markVariantRefreshMiss(variantId: string) {
    await this.prisma.listingVariant.updateMany({
      where: {
        id: variantId,
        inactiveAt: null
      },
      data: {
        refreshMissCount: {
          increment: 1
        },
        lastCrawledAt: new Date(),
        sourceStatus: PrismaSourceListingStatus.MISSING
      }
    });
  }

  private async markRunProgress(
    runId: string,
    rawSnapshotId: string,
    expectedTotal: number,
    succeeded: boolean,
    finalizeRun = true
  ) {
    await this.prisma.ingestionRun.update({
      where: { id: runId },
      data: succeeded
        ? {
            parsedCount: {
              increment: 1
            }
          }
        : {
            failedCount: {
              increment: 1
            }
          }
    });

    const run = await this.prisma.ingestionRun.findUniqueOrThrow({
      where: { id: runId }
    });
    const processed = run.parsedCount + run.failedCount;
    const extractionRate = run.discoveredCount === 0 ? 0 : run.parsedCount / run.discoveredCount;

    await this.prisma.rawSnapshot.update({
      where: { id: rawSnapshotId },
      data: {
        extractionCoverage: expectedTotal === 0 ? 0 : Math.min(1, processed / expectedTotal)
      }
    });

    if (finalizeRun && processed >= run.discoveredCount) {
      await this.prisma.ingestionRun.update({
        where: { id: runId },
        data: {
          status: run.failedCount > 0 && run.parsedCount === 0 ? "failed" : "completed",
          extractionRate,
          completedAt: new Date()
        }
      });
      await this.syncParserDriftAlarm(runId);
    }
  }

  private async syncParserDriftAlarm(runId: string) {
    const run = await this.prisma.ingestionRun.findUnique({
      where: { id: runId }
    });

    if (!run) {
      return;
    }

    const threshold = 0.72;
    const extractionRate = run.extractionRate ?? 0;
    const severity = run.status === "failed" || extractionRate < 0.45 ? "high" : extractionRate < threshold ? "medium" : null;
    const openAlarm = await this.prisma.parserDriftAlarm.findFirst({
      where: {
        source: run.source,
        resolvedAt: null
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (!severity) {
      if (openAlarm) {
        await this.prisma.parserDriftAlarm.update({
          where: { id: openAlarm.id },
          data: {
            resolvedAt: new Date(),
            message: `Recovered on run ${run.id}`
          }
        });
      }

      return;
    }

    const message =
      severity === "high"
        ? `Parser drift alarm: ${this.fromPrismaSource(run.source)} run ${run.id} failed or dropped below the high-risk extraction threshold.`
        : `Parser drift warning: ${this.fromPrismaSource(run.source)} extraction fell below ${(threshold * 100).toFixed(0)}%.`;
    const details = {
      runId: run.id,
      status: run.status,
      discoveredCount: run.discoveredCount,
      parsedCount: run.parsedCount,
      failedCount: run.failedCount,
      extractionRate
    } satisfies Prisma.InputJsonObject;

    if (openAlarm) {
      await this.prisma.parserDriftAlarm.update({
        where: { id: openAlarm.id },
        data: {
          ingestionRunId: run.id,
          severity,
          message,
          threshold,
          details
        }
      });
      return;
    }

    await this.prisma.parserDriftAlarm.create({
      data: {
        source: run.source,
        ingestionRunId: run.id,
        severity,
        message,
        threshold,
        details
      }
    });
  }

  private async filterEnabledSources(sources: ListingSource[]) {
    const controls = await this.prisma.connectorControl.findMany({
      where: {
        source: {
          in: sources.map((source) => toPrismaSource(source))
        },
        isEnabled: false
      }
    });
    const disabled = new Set(controls.map((control) => this.fromPrismaSource(control.source)));

    return sources.filter((source) => !disabled.has(source));
  }

  private async isSourceEnabled(source: ListingSource) {
    const control = await this.prisma.connectorControl.findUnique({
      where: {
        source: toPrismaSource(source)
      }
    });

    return control?.isEnabled ?? true;
  }

  private async isBlacklisted(source: ListingSource, sourceUrl?: string, sourceListingId?: string) {
    const values = [sourceUrl?.trim(), sourceListingId?.trim()].filter((value): value is string => Boolean(value));

    if (values.length === 0) {
      return false;
    }

    const entries = await this.prisma.sourceBlacklist.findMany({
      where: {
        source: toPrismaSource(source),
        value: {
          in: values
        }
      }
    });

    if (entries.length === 0) {
      return false;
    }

    return entries.some((entry) => {
      if (entry.matchType === "source_url" && sourceUrl) {
        return entry.value === sourceUrl.trim();
      }

      if (entry.matchType === "source_listing_id" && sourceListingId) {
        return entry.value === sourceListingId.trim();
      }

      return false;
    });
  }

  private fromPrismaSource(source: PrismaListingSource): ListingSource {
    switch (source) {
      case PrismaListingSource.NAWY:
        return "nawy";
      case PrismaListingSource.PROPERTY_FINDER:
        return "property_finder";
      case PrismaListingSource.AQARMAP:
        return "aqarmap";
      case PrismaListingSource.FACEBOOK:
        return "facebook";
    }
  }

  private fromPrismaPurpose(purpose: PrismaListingPurpose) {
    return purpose === PrismaListingPurpose.RENT ? "rent" : "sale";
  }

  private fromPrismaMarketSegment(segment: PrismaMarketSegment) {
    switch (segment) {
      case PrismaMarketSegment.PRIMARY:
        return "primary";
      case PrismaMarketSegment.OFF_PLAN:
        return "off_plan";
      default:
        return "resale";
    }
  }

  private buildNormalizedEnrichment(normalized: NormalizedListingCandidate) {
    const area = normalizeArea(normalized.areaName, [
      normalized.areaName ?? "",
      normalized.compoundName?.en ?? "",
      normalized.developerName?.en ?? ""
    ]);
    const coordinates = resolveCoordinates(normalized.location, area);
    const normalizedSummary = {
      bedrooms: normalized.bedrooms ?? null,
      bathrooms: normalized.bathrooms ?? null,
      areaSqm: normalized.areaSqm ?? null,
      location: toJsonCoordinates(coordinates),
      compoundName: toJsonLocalizedText(normalized.compoundName),
      developerName: toJsonLocalizedText(normalized.developerName),
      pricePeriod: normalized.price.period ?? null
    } satisfies Prisma.InputJsonObject;
    const persistedRawFields = {
      ...normalized.rawFields,
      area: area
        ? {
            slug: area.slug,
            nameEn: area.nameEn,
            nameAr: area.nameAr,
            centroid: toJsonCoordinates(area.centroid)
          }
        : null,
      geocodedLocation: toJsonCoordinates(coordinates),
      mediaHashes: normalized.mediaHashes,
      normalized: normalizedSummary
    } satisfies Prisma.InputJsonObject;

    return { area, coordinates, persistedRawFields };
  }

  private async upsertAreaRecord(area: ReturnType<typeof normalizeArea>) {
    if (!area) {
      return null;
    }

    return this.prisma.area.upsert({
      where: { slug: area.slug },
      update: {
        nameEn: area.nameEn,
        nameAr: area.nameAr
      },
      create: {
        slug: area.slug,
        nameEn: area.nameEn,
        nameAr: area.nameAr
      }
    });
  }

  private async refreshVariantNormalization(variantId: string, normalized: NormalizedListingCandidate) {
    const enrichment = this.buildNormalizedEnrichment(normalized);
    const areaRecord = await this.upsertAreaRecord(enrichment.area);

    await this.prisma.listingVariant.update({
      where: { id: variantId },
      data: {
        rawFields: enrichment.persistedRawFields
      }
    });

    return areaRecord?.id ?? null;
  }

  private rehydrateNormalizedCandidate(variant: PersistedVariantRecord): NormalizedListingCandidate | null {
    const rawFields = asRecord(variant.rawFields) ?? {};
    const sourcePayload = asRecord(rawFields.sourcePayload);
    const normalizedSummary = asRecord(rawFields.normalized);
    const areaRecord = asRecord(rawFields.area);
    const locationRecord = asCoordinates(normalizedSummary?.location) ?? asCoordinates(rawFields.geocodedLocation);
    const price = this.resolveVariantPrice(variant, sourcePayload, normalizedSummary);

    if (!price) {
      return null;
    }

    const sourceLocation = this.resolveSourcePayloadCoordinates(sourcePayload);
    const sourceLocationPayload = asRecord(sourcePayload?.location);
    const sourceBroker = asRecord(sourcePayload?.broker);
    const sourceSize = asRecord(sourcePayload?.size);
    const sourcePrice = asRecord(sourcePayload?.price);
    const sourceDeveloperPlan = asRecord(sourcePayload?.developerPlan);
    const mediaHashes = asStringArray(rawFields.mediaHashes);
    const sourceAreaName =
      asString(areaRecord?.nameEn) ??
      asString(sourcePayload?.areaName) ??
      asString(sourceLocationPayload?.path_name) ??
      asString(sourceLocationPayload?.full_name);
    const sourceCompound = asLocalizedText(normalizedSummary?.compoundName) ?? this.localizeFromString(sourcePayload?.name);
    const sourceDeveloper =
      asLocalizedText(normalizedSummary?.developerName) ??
      this.localizeFromString(sourcePayload?.developerName) ??
      this.localizeFromString(sourceBroker?.name);

    return {
      id: variant.id,
      source: this.fromPrismaSource(variant.source),
      sourceListingId: variant.sourceListingId,
      sourceUrl: variant.canonicalUrl,
      title: {
        en: variant.titleEn,
        ar: variant.titleAr
      },
      description: {
        en: variant.descriptionEn ?? variant.titleEn,
        ar: variant.descriptionAr ?? variant.titleAr
      },
      purpose: this.fromPrismaPurpose(variant.purpose),
      marketSegment: this.fromPrismaMarketSegment(variant.marketSegment),
      propertyType: variant.propertyType as NormalizedListingCandidate["propertyType"],
      price,
      bedrooms: asNumber(normalizedSummary?.bedrooms) ?? asNumber(sourcePayload?.bedrooms),
      bathrooms: asNumber(normalizedSummary?.bathrooms) ?? asNumber(sourcePayload?.bathrooms),
      areaSqm: asNumber(normalizedSummary?.areaSqm) ?? asNumber(sourceSize?.value),
      compoundName: sourceCompound,
      developerName: sourceDeveloper,
      location: locationRecord ?? sourceLocation,
      imageUrls: variant.imageUrls,
      publishedAt: (variant.publishedAt ?? variant.updatedAt).toISOString(),
      extractionConfidence: variant.extractionConfidence,
      areaName: sourceAreaName,
      mediaHashes: mediaHashes.length > 0 ? mediaHashes : hashImageUrls(variant.imageUrls),
      rawFields: {
        ...rawFields,
        sourcePayload: {
          ...sourcePayload,
          price: sourcePrice ?? undefined,
          developerPlan: sourceDeveloperPlan ?? undefined
        }
      }
    };
  }

  private resolveVariantPrice(
    variant: PersistedVariantRecord,
    sourcePayload: Record<string, unknown> | null,
    normalizedSummary: Record<string, unknown> | null
  ) {
    const sourcePrice = asRecord(sourcePayload?.price);
    const sourceDeveloperPlan = asRecord(sourcePayload?.developerPlan);
    const latestPriceHistory = variant.priceHistory[0];

    if (asNumber(sourcePrice?.value) !== undefined) {
      return {
        amount: asNumber(sourcePrice?.value) ?? 0,
        currency: (asString(sourcePrice?.currency) ?? "EGP") as "EGP",
        period: (asString(sourcePrice?.period) as "monthly" | "total" | undefined) ?? undefined
      };
    }

    if (asNumber(sourceDeveloperPlan?.minPrice) !== undefined) {
      return {
        amount: asNumber(sourceDeveloperPlan?.minPrice) ?? 0,
        currency: (asString(sourceDeveloperPlan?.currency) ?? "EGP") as "EGP",
        period: "total" as const
      };
    }

    if (latestPriceHistory) {
      return {
        amount: latestPriceHistory.price,
        currency: latestPriceHistory.currency as "EGP",
        period:
          (asString(normalizedSummary?.pricePeriod) as "monthly" | "total" | undefined) ??
          (variant.purpose === PrismaListingPurpose.RENT ? "monthly" : "total")
      };
    }

    return null;
  }

  private resolveSourcePayloadCoordinates(sourcePayload: Record<string, unknown> | null) {
    const arrayCoordinates = sourcePayload?.coordinates;

    if (
      Array.isArray(arrayCoordinates) &&
      arrayCoordinates.length === 2 &&
      typeof arrayCoordinates[0] === "number" &&
      typeof arrayCoordinates[1] === "number"
    ) {
      return {
        lat: arrayCoordinates[1],
        lng: arrayCoordinates[0]
      };
    }

    return asCoordinates(asRecord(asRecord(sourcePayload?.location)?.coordinates));
  }

  private localizeFromString(value: unknown) {
    const stringValue = asString(value);

    if (!stringValue) {
      return undefined;
    }

    return {
      en: stringValue,
      ar: stringValue
    };
  }

  private extractVariantSummary(variant: { rawFields: Prisma.JsonValue | null }) {
    const rawFields = (variant.rawFields ?? {}) as {
      normalized?: {
        bedrooms?: number | null;
        bathrooms?: number | null;
        areaSqm?: number | null;
      };
    };

    return {
      bedrooms: rawFields.normalized?.bedrooms ?? undefined,
      bathrooms: rawFields.normalized?.bathrooms ?? undefined,
      areaSqm: rawFields.normalized?.areaSqm ?? undefined
    };
  }

  private async getBestPriceForVariants(variantIds: string[], fallback: number | null) {
    const priceHistory = await this.prisma.priceHistory.findMany({
      where: {
        variantId: {
          in: variantIds
        }
      },
      orderBy: {
        recordedAt: "desc"
      }
    });

    const latestByVariant = new Map<string, number>();

    for (const entry of priceHistory) {
      if (entry.variantId && !latestByVariant.has(entry.variantId)) {
        latestByVariant.set(entry.variantId, entry.price);
      }
    }

    const prices = [...latestByVariant.values()];
    return prices.length > 0 ? Math.min(...prices) : fallback;
  }

  private async syncProjectForCluster(clusterId: string, normalized: NormalizedListingCandidate, areaId: string | null) {
    if (normalized.marketSegment !== "off_plan" || !areaId) {
      return {
        createdProject: false,
        linkedCluster: false
      };
    }

    const sourcePayload = asRecord(normalized.rawFields.sourcePayload);
    const projectName = asString(sourcePayload?.name) ?? normalized.compoundName?.en ?? normalized.title.en;
    const projectSlug = asString(sourcePayload?.slug) ?? slugify(projectName);
    const developerName =
      asString(sourcePayload?.developerName) ?? normalized.developerName?.en ?? "Unknown developer";
    const developerSlug = slugify(developerName) || "unknown-developer";

    if (!projectSlug) {
      return {
        createdProject: false,
        linkedCluster: false
      };
    }

    const developer = await this.prisma.developer.upsert({
      where: { slug: developerSlug },
      update: {
        nameEn: developerName,
        nameAr: developerName
      },
      create: {
        slug: developerSlug,
        nameEn: developerName,
        nameAr: developerName
      }
    });

    const developerPlan = asRecord(sourcePayload?.developerPlan);
    const existingProject = await this.prisma.project.findUnique({
      where: { slug: projectSlug }
    });
    const readyBy = asNumber(developerPlan?.readyBy);
    const sourceUrls = [...new Set([...(existingProject?.sourceUrls ?? []), normalized.sourceUrl])];

    const project = await this.prisma.project.upsert({
      where: { slug: projectSlug },
      update: {
        nameEn: projectName,
        nameAr: projectName,
        developerId: developer.id,
        areaId,
        handoffYear: readyBy ? Math.trunc(readyBy / 10000) : undefined,
        startingPrice: asNumber(developerPlan?.minPrice) ?? normalized.price.amount,
        paymentPlanYears: asNumber(developerPlan?.numberOfInstallmentYears),
        imageUrl: asString(sourcePayload?.imageUrl) ?? normalized.imageUrls[0] ?? existingProject?.imageUrl ?? null,
        sourceUrls
      },
      create: {
        slug: projectSlug,
        nameEn: projectName,
        nameAr: projectName,
        developerId: developer.id,
        areaId,
        handoffYear: readyBy ? Math.trunc(readyBy / 10000) : undefined,
        startingPrice: asNumber(developerPlan?.minPrice) ?? normalized.price.amount,
        paymentPlanYears: asNumber(developerPlan?.numberOfInstallmentYears),
        imageUrl: asString(sourcePayload?.imageUrl) ?? normalized.imageUrls[0] ?? null,
        sourceUrls
      }
    });

    const cluster = await this.prisma.listingCluster.findUniqueOrThrow({
      where: { id: clusterId }
    });

    if (cluster.projectId !== project.id) {
      await this.prisma.listingCluster.update({
        where: { id: clusterId },
        data: {
          projectId: project.id
        }
      });
    }

    return {
      createdProject: existingProject === null,
      linkedCluster: cluster.projectId !== project.id
    };
  }
}
