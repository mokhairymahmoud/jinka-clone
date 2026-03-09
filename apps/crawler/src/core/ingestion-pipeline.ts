import { randomUUID } from "node:crypto";

import {
  FraudLabel as PrismaFraudLabel,
  ListingPurpose as PrismaListingPurpose,
  Prisma,
  ListingSource as PrismaListingSource,
  MarketSegment as PrismaMarketSegment,
  PrismaClient
} from "@prisma/client";

import type { ListingSource } from "@jinka-eg/types";
import type { QueueMap } from "./queue.js";
import type { NormalizedListingCandidate, ParsedListingCandidate, RawPageResult, SourceSeed } from "./connector.js";
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
};

type ParseSnapshotPayload = {
  source: ListingSource;
  runId: string;
  rawSnapshotId: string;
};

type NormalizeVariantPayload = {
  source: ListingSource;
  runId: string;
  rawSnapshotId: string;
  candidate: ParsedListingCandidate;
  expectedTotal: number;
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

  async enqueueSources(sources: ListingSource[]) {
    await Promise.all(
      sources.map((source) =>
        this.queues["seed-source"].add(`seed:${source}:${Date.now()}`, {
          source
        } satisfies SeedSourcePayload)
      )
    );
  }

  async handleSeedSource(payload: SeedSourcePayload) {
    const connector = getConnector(payload.source);
    const run = await this.prisma.ingestionRun.create({
      data: {
        source: toPrismaSource(payload.source),
        status: "running"
      }
    });
    const seeds = await connector.discover();

    if (seeds.length === 0) {
      await this.prisma.ingestionRun.update({
        where: { id: run.id },
        data: {
          status: "completed",
          completedAt: new Date()
        }
      });
      return { runId: run.id, source: payload.source, discoveredSeeds: 0 };
    }

    await Promise.all(
      seeds.map((seed) =>
        this.queues["fetch-page"].add(`fetch:${payload.source}:${run.id}:${seed.label}`, {
          source: payload.source,
          runId: run.id,
          seed
        } satisfies FetchPagePayload)
      )
    );

    return { runId: run.id, source: payload.source, discoveredSeeds: seeds.length };
  }

  async handleFetchPage(payload: FetchPagePayload) {
    const connector = getConnector(payload.source);
    const raw = await connector.fetch(payload.seed);

    await this.storage.ensureBucket();

    const storageKey = buildStorageKey(payload.source, payload.runId, payload.seed.label, raw.payloadType);
    await this.storage.putObject(
      storageKey,
      raw.body,
      raw.payloadType === "json" ? "application/json" : "text/html; charset=utf-8"
    );

    const rawSnapshot = await this.prisma.rawSnapshot.create({
      data: {
        source: toPrismaSource(payload.source),
        sourceListingId: raw.sourceListingId,
        sourceUrl: raw.url,
        payloadType: raw.payloadType,
        storageKey,
        parserVersion: "phase-3",
        fetchedAt: new Date(raw.fetchedAt)
      }
    });

    await this.queues["parse-snapshot"].add(`parse:${payload.source}:${rawSnapshot.id}`, {
      source: payload.source,
      runId: payload.runId,
      rawSnapshotId: rawSnapshot.id
    } satisfies ParseSnapshotPayload);

    return { rawSnapshotId: rawSnapshot.id, source: payload.source };
  }

  async handleParseSnapshot(payload: ParseSnapshotPayload) {
    const connector = getConnector(payload.source);
    const snapshot = await this.prisma.rawSnapshot.findUniqueOrThrow({
      where: { id: payload.rawSnapshotId }
    });
    const body = await this.storage.getObject(snapshot.storageKey);
    const raw: RawPageResult = {
      source: payload.source,
      url: snapshot.sourceUrl,
      sourceListingId: snapshot.sourceListingId ?? undefined,
      payloadType: snapshot.payloadType as "html" | "json",
      body,
      fetchedAt: snapshot.fetchedAt.toISOString()
    };
    const candidates = await connector.parse(raw);

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
      return { source: payload.source, candidates: 0 };
    }

    await Promise.all(
      candidates.map((candidate, index) =>
        this.queues["normalize-variant"].add(`normalize:${payload.source}:${payload.rawSnapshotId}:${index}`, {
          source: payload.source,
          runId: payload.runId,
          rawSnapshotId: payload.rawSnapshotId,
          candidate,
          expectedTotal: candidates.length
        } satisfies NormalizeVariantPayload)
      )
    );

    return { source: payload.source, candidates: candidates.length };
  }

  async handleNormalizeVariant(payload: NormalizeVariantPayload) {
    const connector = getConnector(payload.source);
    const normalized = await connector.normalize(payload.candidate);

    if (!normalized) {
      await this.markRunProgress(payload.runId, payload.rawSnapshotId, payload.expectedTotal, false);
      return { source: payload.source, normalized: false };
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
        imageUrls: normalized.imageUrls
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
        imageUrls: normalized.imageUrls
      }
    });

    const clusterSync = await this.syncClusterForVariant(variant.id, normalized, areaRecord?.id ?? null);
    await this.syncProjectForCluster(clusterSync.clusterId, normalized, areaRecord?.id ?? null);
    await this.persistPriceHistory(variant.id, clusterSync.clusterId, normalized.price);
    await this.markRunProgress(payload.runId, payload.rawSnapshotId, payload.expectedTotal, true);

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

  async backfillExistingVariants(options: { limit?: number } = {}) {
    const variants = await this.prisma.listingVariant.findMany({
      where: {
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
      linkedProjectClusters: 0
    };

    for (const variant of variants) {
      const normalized = this.rehydrateNormalizedCandidate(variant);

      if (!normalized) {
        summary.skippedVariants += 1;
        continue;
      }

      const areaId = await this.refreshVariantNormalization(variant.id, normalized);
      const clusterSync =
        variant.clusterId !== null
          ? { clusterId: variant.clusterId, eventType: undefined }
          : await this.syncClusterForVariant(variant.id, normalized, areaId);
      const projectSync = await this.syncProjectForCluster(clusterSync.clusterId, normalized, areaId);

      if (clusterSync.eventType === "new_listing") {
        summary.backfilledClusters += 1;
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

  async markRunFailed(runId: string | undefined, _message: string) {
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
  ) {
    const variant = await this.prisma.listingVariant.findUniqueOrThrow({
      where: { id: variantId }
    });

    if (!variant.clusterId) {
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

      await this.prisma.listingVariant.update({
        where: { id: variant.id },
        data: {
          clusterId: cluster.id
        }
      });

      return { clusterId: cluster.id, eventType: "new_listing" as const };
    }

    const cluster = await this.prisma.listingCluster.findUniqueOrThrow({
      where: { id: variant.clusterId }
    });
    const nextBestPrice = cluster.bestPrice ? Math.min(cluster.bestPrice, normalized.price.amount) : normalized.price.amount;

    await this.prisma.listingCluster.update({
      where: { id: cluster.id },
      data: {
        canonicalTitleEn: normalized.title.en,
        canonicalTitleAr: normalized.title.ar,
        areaId: areaId ?? cluster.areaId ?? undefined,
        bedrooms: normalized.bedrooms ?? cluster.bedrooms,
        bathrooms: normalized.bathrooms ?? cluster.bathrooms,
        areaSqm: normalized.areaSqm ?? cluster.areaSqm,
        bestPrice: nextBestPrice
      }
    });

    return {
      clusterId: cluster.id,
      eventType: cluster.bestPrice && normalized.price.amount < cluster.bestPrice ? ("price_drop" as const) : undefined
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

  private async markRunProgress(runId: string, rawSnapshotId: string, expectedTotal: number, succeeded: boolean) {
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

    if (processed >= expectedTotal) {
      await this.prisma.rawSnapshot.update({
        where: { id: rawSnapshotId },
        data: {
          extractionCoverage: expectedTotal === 0 ? 0 : run.parsedCount / expectedTotal
        }
      });
      await this.prisma.ingestionRun.update({
        where: { id: runId },
        data: {
          status: run.failedCount > 0 && run.parsedCount === 0 ? "failed" : "completed",
          extractionRate: expectedTotal === 0 ? 0 : run.parsedCount / expectedTotal,
          completedAt: new Date()
        }
      });
    }
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
