import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { ProjectSummary } from "@jinka-eg/types";
import { PrismaService } from "../common/prisma.service.js";

function localizedText(en?: string | null, ar?: string | null) {
  const safe = (en ?? ar ?? "Unknown").trim();
  return {
    en: safe,
    ar: (ar ?? safe).trim()
  };
}

@Injectable()
export class ProjectsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll(query?: string): Promise<ProjectSummary[]> {
    const projects = await this.prisma.project.findMany({
      where: query
        ? {
            OR: [
              { nameEn: { contains: query, mode: "insensitive" } },
              { nameAr: { contains: query, mode: "insensitive" } },
              { developer: { is: { nameEn: { contains: query, mode: "insensitive" } } } },
              { developer: { is: { nameAr: { contains: query, mode: "insensitive" } } } },
              { area: { is: { nameEn: { contains: query, mode: "insensitive" } } } },
              { area: { is: { nameAr: { contains: query, mode: "insensitive" } } } }
            ]
          }
        : undefined,
      include: {
        developer: true,
        area: true
      },
      orderBy: [{ startingPrice: "asc" }, { updatedAt: "desc" }]
    });

    return projects.map((project) => this.mapProject(project));
  }

  async findOne(id: string): Promise<ProjectSummary> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        developer: true,
        area: true
      }
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    return this.mapProject(project);
  }

  private mapProject(project: ProjectRecord): ProjectSummary {
    return {
      id: project.id,
      name: localizedText(project.nameEn, project.nameAr),
      developerName: localizedText(project.developer.nameEn, project.developer.nameAr),
      area: {
        id: project.area.id,
        slug: project.area.slug,
        name: localizedText(project.area.nameEn, project.area.nameAr)
      },
      handoffYear: project.handoffYear ?? undefined,
      startingPrice: project.startingPrice
        ? {
            amount: project.startingPrice,
            currency: "EGP",
            period: "total"
          }
        : undefined,
      paymentPlanYears: project.paymentPlanYears ?? undefined,
      imageUrl: project.imageUrl ?? "",
      sourceUrls: project.sourceUrls
    };
  }
}
type ProjectRecord = Prisma.ProjectGetPayload<{
  include: {
    developer: true;
    area: true;
  };
}>;
