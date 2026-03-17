import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { FraudLabel, ListingSource, Prisma } from "@prisma/client";

import type { FraudAssessment } from "@jinka-eg/types";
import { PrismaService as AppPrismaService } from "../common/prisma.service.js";
import { SearchDocumentsService } from "../common/search-documents.service.js";

type ConnectorHealth = {
  source: string;
  status: "healthy" | "degraded" | "limited";
  lastSuccessAt: string | null;
  parserCoverage: number;
  enabled: boolean;
  disabledReason: string | null;
};

type ClusterEdgeReason = {
  code?: string;
  message?: string;
  weight?: number;
};

@Injectable()
export class AdminService {
  constructor(
    @Inject(AppPrismaService) private readonly prisma: AppPrismaService,
    @Inject(SearchDocumentsService) private readonly searchDocuments: SearchDocumentsService
  ) {}

  async getConnectorHealth(): Promise<ConnectorHealth[]> {
    const latestRuns = await this.prisma.ingestionRun.findMany({
      orderBy: {
        startedAt: "desc"
      }
    });
    const controls = await this.prisma.connectorControl.findMany();
    const controlMap = new Map(controls.map((control) => [control.source, control]));

    return [ListingSource.NAWY, ListingSource.PROPERTY_FINDER, ListingSource.AQARMAP, ListingSource.FACEBOOK].map(
      (source) => {
        const latest = latestRuns.find((run) => run.source === source);
        const extractionRate = latest?.extractionRate ?? 0;
        const control = controlMap.get(source);
        const enabled = control?.isEnabled ?? true;

        return {
          source: this.fromPrismaSource(source),
          status: enabled ? (extractionRate >= 0.85 ? "healthy" : extractionRate >= 0.6 ? "degraded" : "limited") : "limited",
          lastSuccessAt: latest?.completedAt?.toISOString() ?? null,
          parserCoverage: extractionRate,
          enabled,
          disabledReason: control?.disabledReason ?? null
        };
      }
    );
  }

  async disableConnector(actorId: string, source: string, reason?: string) {
    const prismaSource = this.toPrismaSource(source);
    const control = await this.prisma.connectorControl.upsert({
      where: { source: prismaSource },
      update: {
        isEnabled: false,
        disabledReason: reason ?? "Disabled by operations"
      },
      create: {
        source: prismaSource,
        isEnabled: false,
        disabledReason: reason ?? "Disabled by operations"
      }
    });

    await this.prisma.adminAuditLog.create({
      data: {
        userId: actorId,
        action: "connector.disable",
        entityType: "ConnectorControl",
        entityId: control.id,
        afterState: {
          source,
          isEnabled: false,
          disabledReason: control.disabledReason
        }
      }
    });

    return {
      source,
      enabled: false,
      disabledReason: control.disabledReason
    };
  }

  async enableConnector(actorId: string, source: string) {
    const prismaSource = this.toPrismaSource(source);
    const control = await this.prisma.connectorControl.upsert({
      where: { source: prismaSource },
      update: {
        isEnabled: true,
        disabledReason: null
      },
      create: {
        source: prismaSource,
        isEnabled: true
      }
    });

    await this.prisma.adminAuditLog.create({
      data: {
        userId: actorId,
        action: "connector.enable",
        entityType: "ConnectorControl",
        entityId: control.id,
        afterState: {
          source,
          isEnabled: true
        }
      }
    });

    return {
      source,
      enabled: true,
      disabledReason: null
    };
  }

  async getBlacklists() {
    const entries = await this.prisma.sourceBlacklist.findMany({
      include: {
        createdBy: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 100
    });

    return entries.map((entry) => ({
      id: entry.id,
      source: this.fromPrismaSource(entry.source),
      matchType: entry.matchType,
      value: entry.value,
      reason: entry.reason ?? undefined,
      createdAt: entry.createdAt.toISOString(),
      createdBy: entry.createdBy.email
    }));
  }

  async getParserDriftAlarms() {
    const alarms = await this.prisma.parserDriftAlarm.findMany({
      include: {
        ingestionRun: true
      },
      orderBy: [{ resolvedAt: "asc" }, { createdAt: "desc" }],
      take: 50
    });

    return alarms.map((alarm) => ({
      id: alarm.id,
      source: this.fromPrismaSource(alarm.source),
      severity: alarm.severity,
      message: alarm.message,
      threshold: alarm.threshold,
      resolved: Boolean(alarm.resolvedAt),
      createdAt: alarm.createdAt.toISOString(),
      resolvedAt: alarm.resolvedAt?.toISOString() ?? null,
      run: {
        id: alarm.ingestionRun.id,
        status: alarm.ingestionRun.status,
        extractionRate: alarm.ingestionRun.extractionRate,
        failedCount: alarm.ingestionRun.failedCount,
        parsedCount: alarm.ingestionRun.parsedCount
      }
    }));
  }

  async resolveParserDriftAlarm(actorId: string, alarmId: string) {
    const alarm = await this.prisma.parserDriftAlarm.findUnique({
      where: { id: alarmId }
    });

    if (!alarm) {
      throw new NotFoundException("Parser drift alarm not found");
    }

    const resolved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.parserDriftAlarm.update({
        where: { id: alarmId },
        data: {
          resolvedAt: new Date()
        }
      });

      await tx.adminAuditLog.create({
        data: {
          userId: actorId,
          action: "parser_drift.resolve",
          entityType: "ParserDriftAlarm",
          entityId: alarmId,
          beforeState: {
            resolvedAt: alarm.resolvedAt
          },
          afterState: {
            resolvedAt: updated.resolvedAt
          }
        }
      });

      return updated;
    });

    return {
      id: resolved.id,
      resolved: true,
      resolvedAt: resolved.resolvedAt?.toISOString() ?? null
    };
  }

  async createBlacklist(
    actorId: string,
    payload: {
      source: string;
      matchType: string;
      value: string;
      reason?: string;
    }
  ) {
    const entry = await this.prisma.sourceBlacklist.upsert({
      where: {
        source_matchType_value: {
          source: this.toPrismaSource(payload.source),
          matchType: payload.matchType,
          value: payload.value.trim()
        }
      },
      update: {
        reason: payload.reason ?? undefined
      },
      create: {
        source: this.toPrismaSource(payload.source),
        matchType: payload.matchType,
        value: payload.value.trim(),
        reason: payload.reason,
        createdById: actorId
      }
    });

    await this.prisma.adminAuditLog.create({
      data: {
        userId: actorId,
        action: "blacklist.create",
        entityType: "SourceBlacklist",
        entityId: entry.id,
        afterState: {
          source: payload.source,
          matchType: payload.matchType,
          value: payload.value.trim(),
          reason: payload.reason ?? null
        }
      }
    });

    return {
      id: entry.id,
      source: payload.source,
      matchType: entry.matchType,
      value: entry.value,
      reason: entry.reason ?? undefined
    };
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

  async getClusterEdges() {
    const edges = await this.prisma.clusterEdge.findMany({
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 30
    });

    if (edges.length === 0) {
      return [];
    }

    const variantIds = [...new Set(edges.flatMap((edge) => [edge.leftVariantId, edge.rightVariantId]))];
    const variants = await this.prisma.listingVariant.findMany({
      where: {
        id: {
          in: variantIds
        }
      }
    });
    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

    return edges
      .map((edge) => {
        const left = variantMap.get(edge.leftVariantId);
        const right = variantMap.get(edge.rightVariantId);

        if (!left || !right) {
          return null;
        }

        if (!left.clusterId || !right.clusterId || left.clusterId === right.clusterId) {
          return null;
        }

        const reasonPayload = edge.reasons as {
          decision?: string;
          reasons?: ClusterEdgeReason[];
        } | null;

        return {
          id: edge.id,
          score: edge.score,
          decision: reasonPayload?.decision ?? (edge.score >= 0.72 ? "auto_attach" : "review"),
          sourceClusterId: left.clusterId,
          targetClusterId: right.clusterId,
          leftVariant: {
            id: left.id,
            source: this.fromPrismaSource(left.source),
            titleEn: left.titleEn,
            sourceListingId: left.sourceListingId
          },
          rightVariant: {
            id: right.id,
            source: this.fromPrismaSource(right.source),
            titleEn: right.titleEn,
            sourceListingId: right.sourceListingId
          },
          reasons: (reasonPayload?.reasons ?? []).map((reason) => ({
            code: reason.code ?? "signal",
            message: reason.message ?? "Dedup signal detected.",
            weight: reason.weight ?? 0
          }))
        };
      })
      .filter((edge): edge is NonNullable<typeof edge> => edge !== null);
  }

  async getReports() {
    const reports = await this.prisma.report.findMany({
      include: {
        user: true,
        cluster: true
      },
      orderBy: [{ resolvedAt: "asc" }, { createdAt: "desc" }],
      take: 50
    });

    return reports.map((report) => ({
      id: report.id,
      clusterId: report.clusterId,
      clusterTitleEn: report.cluster.canonicalTitleEn,
      reason: report.reason,
      details: report.details ?? undefined,
      resolved: Boolean(report.resolvedAt),
      resolutionNote: report.resolutionNote ?? undefined,
      reportedBy: report.user.email,
      createdAt: report.createdAt.toISOString()
    }));
  }

  async resolveReport(actorId: string, reportId: string, resolutionNote?: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId }
    });

    if (!report) {
      throw new NotFoundException("Report not found");
    }

    const resolved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.report.update({
        where: { id: reportId },
        data: {
          resolvedAt: new Date(),
          resolutionNote: resolutionNote ?? report.resolutionNote ?? "Reviewed by support"
        }
      });

      await tx.adminAuditLog.create({
        data: {
          userId: actorId,
          action: "report.resolve",
          entityType: "Report",
          entityId: reportId,
          beforeState: {
            resolvedAt: report.resolvedAt,
            resolutionNote: report.resolutionNote
          },
          afterState: {
            resolvedAt: updated.resolvedAt,
            resolutionNote: updated.resolutionNote
          }
        }
      });

      return updated;
    });

    return {
      id: resolved.id,
      clusterId: resolved.clusterId,
      resolved: true,
      resolutionNote: resolved.resolutionNote ?? undefined
    };
  }

  async mergeCluster(actorId: string, sourceClusterId: string, targetClusterId: string) {
    if (sourceClusterId === targetClusterId) {
      throw new BadRequestException("Source and target cluster must differ");
    }

    const [source, target] = await Promise.all([
      this.prisma.listingCluster.findUnique({
        where: { id: sourceClusterId },
        include: { variants: true }
      }),
      this.prisma.listingCluster.findUnique({
        where: { id: targetClusterId },
        include: { variants: true }
      })
    ]);

    if (!source || !target) {
      throw new NotFoundException("Cluster not found");
    }

    const movedVariantIds = source.variants.map((variant) => variant.id);
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
        tx.listingVariant.updateMany({
          where: { clusterId: sourceClusterId },
          data: { clusterId: targetClusterId }
        })
      ]);

      await tx.listingCluster.update({
        where: { id: targetClusterId },
        data: {
          canonicalTitleEn: target.canonicalTitleEn || source.canonicalTitleEn,
          canonicalTitleAr: target.canonicalTitleAr || source.canonicalTitleAr,
          projectId: target.projectId ?? source.projectId ?? undefined,
          areaId: target.areaId ?? source.areaId ?? undefined,
          bedrooms: target.bedrooms ?? source.bedrooms,
          bathrooms: target.bathrooms ?? source.bathrooms,
          areaSqm: target.areaSqm ?? source.areaSqm,
          bestPrice: this.minPrice(target.bestPrice, source.bestPrice),
          fraudLabel: this.moreSevereLabel(target.fraudLabel, source.fraudLabel),
          fraudScore: Math.max(target.fraudScore, source.fraudScore)
        }
      });

      await tx.adminAuditLog.create({
        data: {
          userId: actorId,
          action: "cluster.merge",
          entityType: "ListingCluster",
          entityId: sourceClusterId,
          beforeState: {
            sourceClusterId,
            targetClusterId,
            movedVariantIds
          },
          afterState: {
            mergedInto: targetClusterId
          }
        }
      });

      await tx.listingCluster.delete({
        where: { id: sourceClusterId }
      });
    });

    await this.searchDocuments.refreshAllSafely("cluster merge");

    return {
      mergedFrom: sourceClusterId,
      mergedInto: targetClusterId,
      movedVariantCount: movedVariantIds.length
    };
  }

  async splitCluster(actorId: string, sourceClusterId: string, variantIds: string[]) {
    const source = await this.prisma.listingCluster.findUnique({
      where: { id: sourceClusterId },
      include: {
        variants: true
      }
    });

    if (!source) {
      throw new NotFoundException("Cluster not found");
    }

    const selectedVariants = source.variants.filter((variant) => variantIds.includes(variant.id));

    if (selectedVariants.length === 0 || selectedVariants.length === source.variants.length) {
      throw new BadRequestException("Split must move at least one, but not all, variants");
    }

    const selectedVariantIds = selectedVariants.map((variant) => variant.id);
    const remainingVariantIds = source.variants.filter((variant) => !variantIds.includes(variant.id)).map((variant) => variant.id);
    const seedVariant = selectedVariants[0];
    const normalized = this.extractVariantSummary(seedVariant);
    const newBestPrice = await this.getBestPriceForVariants(selectedVariantIds, source.bestPrice);
    const remainingBestPrice = await this.getBestPriceForVariants(remainingVariantIds, source.bestPrice);

    const newCluster = await this.prisma.$transaction(async (tx) => {
      const cluster = await tx.listingCluster.create({
        data: {
          canonicalTitleEn: seedVariant.titleEn,
          canonicalTitleAr: seedVariant.titleAr,
          purpose: seedVariant.purpose,
          marketSegment: seedVariant.marketSegment,
          propertyType: seedVariant.propertyType,
          projectId: source.projectId ?? undefined,
          areaId: source.areaId ?? undefined,
          bedrooms: normalized.bedrooms ?? source.bedrooms,
          bathrooms: normalized.bathrooms ?? source.bathrooms,
          areaSqm: normalized.areaSqm ?? source.areaSqm,
          bestPrice: newBestPrice,
          currency: source.currency,
          fraudLabel: FraudLabel.SAFE,
          fraudScore: 0.08
        }
      });

      await Promise.all([
        tx.listingVariant.updateMany({
          where: {
            id: {
              in: selectedVariantIds
            }
          },
          data: {
            clusterId: cluster.id
          }
        }),
        tx.priceHistory.updateMany({
          where: {
            variantId: {
              in: selectedVariantIds
            }
          },
          data: {
            clusterId: cluster.id
          }
        }),
        tx.listingCluster.update({
          where: { id: sourceClusterId },
          data: {
            bestPrice: remainingBestPrice
          }
        }),
        tx.adminAuditLog.create({
          data: {
            userId: actorId,
            action: "cluster.split",
            entityType: "ListingCluster",
            entityId: sourceClusterId,
            beforeState: {
              sourceClusterId,
              variantIds: selectedVariantIds
            },
            afterState: {
              newClusterId: cluster.id
            }
          }
        })
      ]);

      return cluster;
    });

    await this.searchDocuments.refreshAllSafely("cluster split");

    return {
      sourceClusterId,
      newClusterId: newCluster.id,
      splitVariantCount: selectedVariantIds.length
    };
  }

  async resolveFraudCase(actorId: string, fraudCaseId: string, label: FraudAssessment["label"]) {
    const fraudCase = await this.prisma.fraudCase.findUnique({
      where: { id: fraudCaseId }
    });

    if (!fraudCase) {
      throw new NotFoundException("Fraud case not found");
    }

    const nextLabel = this.toPrismaFraudLabel(label);
    const nextScore = nextLabel === FraudLabel.HIGH_RISK ? 0.9 : nextLabel === FraudLabel.REVIEW ? 0.5 : 0.12;

    await this.prisma.$transaction(async (tx) => {
      await tx.fraudCase.update({
        where: { id: fraudCaseId },
        data: {
          operatorOverride: nextLabel,
          resolvedAt: new Date()
        }
      });

      await tx.listingCluster.update({
        where: { id: fraudCase.clusterId },
        data: {
          fraudLabel: nextLabel,
          fraudScore: nextScore
        }
      });

      await tx.adminAuditLog.create({
        data: {
          userId: actorId,
          action: "fraud.resolve",
          entityType: "FraudCase",
          entityId: fraudCaseId,
          beforeState: {
            previousLabel: fraudCase.label
          },
          afterState: {
            nextLabel
          }
        }
      });
    });

    return {
      id: fraudCaseId,
      clusterId: fraudCase.clusterId,
      label,
      resolved: true
    };
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

  private toPrismaSource(source: string) {
    switch (source) {
      case "nawy":
        return ListingSource.NAWY;
      case "property_finder":
        return ListingSource.PROPERTY_FINDER;
      case "aqarmap":
        return ListingSource.AQARMAP;
      case "facebook":
        return ListingSource.FACEBOOK;
      default:
        throw new BadRequestException("Unsupported connector source");
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

  private toPrismaFraudLabel(label: FraudAssessment["label"]) {
    switch (label) {
      case "high_risk":
        return FraudLabel.HIGH_RISK;
      case "review":
        return FraudLabel.REVIEW;
      default:
        return FraudLabel.SAFE;
    }
  }

  private minPrice(...prices: Array<number | null>) {
    const values = prices.filter((price): price is number => price !== null);
    return values.length > 0 ? Math.min(...values) : null;
  }

  private moreSevereLabel(left: FraudLabel, right: FraudLabel) {
    const order = {
      [FraudLabel.SAFE]: 0,
      [FraudLabel.REVIEW]: 1,
      [FraudLabel.HIGH_RISK]: 2
    } satisfies Record<FraudLabel, number>;

    return order[left] >= order[right] ? left : right;
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
}
