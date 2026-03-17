import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../common/prisma.service.js";

function localizedText(en?: string | null, ar?: string | null) {
  const safe = (en ?? ar ?? "Unknown").trim();
  return {
    en: safe,
    ar: (ar ?? safe).trim()
  };
}

@Injectable()
export class AreasService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAreas(query?: string) {
    const areas = await this.prisma.area.findMany({
      where: query
        ? {
            OR: [
              { nameEn: { contains: query, mode: "insensitive" } },
              { nameAr: { contains: query, mode: "insensitive" } },
              { slug: { contains: query, mode: "insensitive" } }
            ]
          }
        : undefined,
      orderBy: [{ parentId: "asc" }, { nameEn: "asc" }],
      take: 60
    });

    return areas.map((area) => ({
      id: area.id,
      slug: area.slug,
      parentId: area.parentId ?? undefined,
      name: localizedText(area.nameEn, area.nameAr)
    }));
  }
}
