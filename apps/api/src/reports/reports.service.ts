import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import type { ReportRecord } from "@jinka-eg/types";
import { PrismaService } from "../common/prisma.service.js";
import { ListingsService } from "../listings/listings.service.js";

@Injectable()
export class ReportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ListingsService) private readonly listingsService: ListingsService
  ) {}

  async createReport(userId: string, clusterId: string, reason: string, details?: string): Promise<ReportRecord> {
    await this.listingsService.findOne(clusterId);

    const report = await this.prisma.report.create({
      data: {
        userId,
        clusterId,
        reason,
        details
      }
    });

    return {
      id: report.id,
      clusterId: report.clusterId,
      reason: report.reason,
      details: report.details ?? undefined,
      resolved: Boolean(report.resolvedAt),
      resolutionNote: report.resolutionNote ?? undefined,
      createdAt: report.createdAt.toISOString()
    };
  }

  async getOwnReports(userId: string): Promise<ReportRecord[]> {
    const reports = await this.prisma.report.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    return reports.map((report) => ({
      id: report.id,
      clusterId: report.clusterId,
      reason: report.reason,
      details: report.details ?? undefined,
      resolved: Boolean(report.resolvedAt),
      resolutionNote: report.resolutionNote ?? undefined,
      createdAt: report.createdAt.toISOString()
    }));
  }

  async getAdminReports() {
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
}
