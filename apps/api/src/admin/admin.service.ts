import { Inject, Injectable } from "@nestjs/common";
import { ListingSource } from "@prisma/client";

import type { FraudAssessment } from "@jinka-eg/types";
import { PrismaService as AppPrismaService } from "../common/prisma.service.js";

type ConnectorHealth = {
  source: string;
  status: "healthy" | "degraded" | "limited";
  lastSuccessAt: string | null;
  parserCoverage: number;
};

@Injectable()
export class AdminService {
  constructor(@Inject(AppPrismaService) private readonly prisma: AppPrismaService) {}

  async getConnectorHealth(): Promise<ConnectorHealth[]> {
    const latestRuns = await this.prisma.ingestionRun.findMany({
      orderBy: {
        startedAt: "desc"
      }
    });

    return [ListingSource.NAWY, ListingSource.PROPERTY_FINDER, ListingSource.AQARMAP, ListingSource.FACEBOOK].map(
      (source) => {
        const latest = latestRuns.find((run) => run.source === source);
        const extractionRate = latest?.extractionRate ?? 0;

        return {
          source: this.fromPrismaSource(source),
          status: extractionRate >= 0.85 ? "healthy" : extractionRate >= 0.6 ? "degraded" : "limited",
          lastSuccessAt: latest?.completedAt?.toISOString() ?? null,
          parserCoverage: extractionRate
        };
      }
    );
  }

  async getIngestionRuns() {
    const runs = await this.prisma.ingestionRun.findMany({
      orderBy: {
        startedAt: "desc"
      },
      take: 20
    });

    return runs.map((run) => ({
      id: run.id,
      source: this.fromPrismaSource(run.source),
      status: run.status,
      discoveredCount: run.discoveredCount,
      parsedCount: run.parsedCount,
      failedCount: run.failedCount,
      extractionRate: run.extractionRate,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null
    }));
  }

  async getFraudCases() {
    const cases = await this.prisma.fraudCase.findMany({
      include: {
        cluster: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 20
    });

    return cases.map((entry) => ({
      id: entry.id,
      clusterId: entry.clusterId,
      label: this.fromFraudLabel(entry.label),
      score: entry.score,
      explanation: entry.explanation,
      resolved: Boolean(entry.resolvedAt),
      canonicalTitleEn: entry.cluster.canonicalTitleEn
    }));
  }

  private fromPrismaSource(source: ListingSource) {
    switch (source) {
      case ListingSource.NAWY:
        return "nawy";
      case ListingSource.PROPERTY_FINDER:
        return "property_finder";
      case ListingSource.AQARMAP:
        return "aqarmap";
      case ListingSource.FACEBOOK:
        return "facebook";
    }
  }

  private fromFraudLabel(label: "SAFE" | "REVIEW" | "HIGH_RISK"): FraudAssessment["label"] {
    switch (label) {
      case "HIGH_RISK":
        return "high_risk";
      case "REVIEW":
        return "review";
      default:
        return "safe";
    }
  }
}
