import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { ProjectSummary, SearchSort } from "@jinka-eg/types";
import { SearchDocumentsService } from "../common/search-documents.service.js";
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
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SearchDocumentsService) private readonly searchDocuments: SearchDocumentsService
  ) {}

  async findAll(query?: string, sort?: SearchSort): Promise<ProjectSummary[]> {
    const rows = await this.searchDocuments.searchProjectIds(query, sort);

    if (rows.length === 0) {
      return [];
    }

    const projects = await this.prisma.project.findMany({
      where: {
        id: {
          in: rows.map((row) => row.projectId)
        }
      },
      include: {
        developer: true,
        area: true
      }
    });

    const projectMap = new Map(projects.map((project) => [project.id, project]));
    return rows
      .map((row) => projectMap.get(row.projectId))
      .filter((project): project is ProjectRecord => Boolean(project))
      .map((project) => this.mapProject(project));
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
