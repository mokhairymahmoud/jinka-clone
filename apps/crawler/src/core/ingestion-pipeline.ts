import { randomUUID } from "node:crypto";

import {
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

type NoopStagePayload = {
  source: ListingSource;
  runId: string;
  stage: "score-cluster" | "score-fraud" | "match-alerts" | "send-notification";
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

function toJsonCoordinates(coordinates?: { lat: number; lng: number } | null) {
  if (!coordinates) {
    return null;
  }

  return {
    lat: coordinates.lat,
    lng: coordinates.lng
  } satisfies Prisma.InputJsonObject;
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
        parserVersion: "phase-2",
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

    const area = normalizeArea(normalized.areaName, [
      normalized.areaName ?? "",
      normalized.compoundName?.en ?? "",
      normalized.developerName?.en ?? ""
    ]);
    const coordinates = resolveCoordinates(normalized.location, area);
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
      mediaHashes: normalized.mediaHashes
    } satisfies Prisma.InputJsonObject;

    if (area) {
      await this.prisma.area.upsert({
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

    await this.prisma.listingVariant.upsert({
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
        rawFields: persistedRawFields,
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
        rawFields: persistedRawFields,
        imageUrls: normalized.imageUrls
      }
    });

    await this.persistPriceHistory(normalized);
    await this.markRunProgress(payload.runId, payload.rawSnapshotId, payload.expectedTotal, true);

    await this.queues["score-cluster"].add(`score-cluster:${payload.source}:${normalized.sourceListingId}`, {
      source: payload.source,
      runId: payload.runId,
      stage: "score-cluster"
    } satisfies NoopStagePayload);

    return { source: payload.source, normalized: true, sourceListingId: normalized.sourceListingId };
  }

  async handleNoopStage(payload: NoopStagePayload) {
    if (payload.stage === "score-cluster") {
      await this.queues["score-fraud"].add(`score-fraud:${payload.source}:${payload.runId}:${Date.now()}`, {
        source: payload.source,
        runId: payload.runId,
        stage: "score-fraud"
      } satisfies NoopStagePayload);
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

  async markRunFailed(runId: string | undefined, message: string) {
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

  private async persistPriceHistory(normalized: NormalizedListingCandidate) {
    const existingLatest = await this.prisma.priceHistory.findFirst({
      where: {
        variant: {
          source: toPrismaSource(normalized.source),
          sourceListingId: normalized.sourceListingId
        }
      },
      orderBy: {
        recordedAt: "desc"
      }
    });

    if (existingLatest?.price === normalized.price.amount) {
      return;
    }

    const variant = await this.prisma.listingVariant.findUniqueOrThrow({
      where: {
        source_sourceListingId: {
          source: toPrismaSource(normalized.source),
          sourceListingId: normalized.sourceListingId
        }
      }
    });

    await this.prisma.priceHistory.create({
      data: {
        variantId: variant.id,
        price: normalized.price.amount,
        currency: normalized.price.currency
      }
    });
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
}
