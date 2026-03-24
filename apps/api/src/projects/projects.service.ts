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

function areaTypeToPublic(value?: string | null) {
  return value ? value.toLowerCase() as "governorate" | "city" | "area" : undefined;
}

function toAreaReference(
  area:
    | {
        id: string;
        slug: string;
        type?: string | null;
        parentId?: string | null;
        nameEn?: string | null;
        nameAr?: string | null;
      }
    | null
) {
  return {
    id: area?.id ?? "unknown-area",
    slug: area?.slug ?? "unknown-area",
    type: areaTypeToPublic(area?.type) ?? "area",
    parentId: area?.parentId ?? undefined,
    name: localizedText(area?.nameEn, area?.nameAr)
  };
}

function buildGeoReference(
  area:
    | {
        id: string;
        slug: string;
        type: string;
        parentId: string | null;
        nameEn: string;
        nameAr: string;
        parent:
          | {
              id: string;
              slug: string;
              type: string;
              parentId: string | null;
              nameEn: string;
              nameAr: string;
              parent:
                | {
                    id: string;
                    slug: string;
                    type: string;
                    parentId: string | null;
                    nameEn: string;
                    nameAr: string;
                  }
                | null;
            }
          | null;
      }
    | null
) {
  if (!area) {
    return undefined;
  }

  const chain = [area.parent?.parent, area.parent, area]
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .map((entry) => toAreaReference(entry));

  return {
    governorate: chain.find((entry) => entry.type === "governorate"),
    city: chain.find((entry) => entry.type === "city"),
    area: chain.find((entry) => entry.type === "area"),
    leaf: toAreaReference(area)
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
        area: {
          include: {
            parent: {
              include: {
                parent: true
              }
            }
          }
        }
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
        area: {
          include: {
            parent: {
              include: {
                parent: true
              }
            }
          }
        }
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
      area: toAreaReference(project.area),
      geo: buildGeoReference(project.area),
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
    area: {
      include: {
        parent: {
          include: {
            parent: true;
          };
        };
      };
    };
  };
}>;
