import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { Coordinates, ListingCluster, ListingVariant, SearchFilters } from "@jinka-eg/types";
import { PrismaService } from "../common/prisma.service.js";

type ClusterRecord = Prisma.ListingClusterGetPayload<{
  include: {
    area: true;
    variants: {
      orderBy: {
        updatedAt: "desc";
      };
    };
    fraudCases: {
      orderBy: {
        createdAt: "desc";
      };
    };
  };
}>;

function enumToPublic<T extends string>(value: T) {
  return value.toLowerCase() as Lowercase<T>;
}

function localizedText(en?: string | null, ar?: string | null) {
  const safe = (en ?? ar ?? "Unknown").trim();
  return {
    en: safe,
    ar: (ar ?? safe).trim()
  };
}

function toCoordinates(value: unknown): Coordinates | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const maybe = value as { lat?: unknown; lng?: unknown };

  return typeof maybe.lat === "number" && typeof maybe.lng === "number"
    ? {
        lat: maybe.lat,
        lng: maybe.lng
      }
    : undefined;
}

function getVariantPrice(rawFields: Record<string, unknown>, fallback: number, purpose: "rent" | "sale") {
  const sourcePayload = rawFields.sourcePayload as
    | {
        price?: { value?: number; currency?: string; period?: "monthly" | "total" };
        developerPlan?: { minPrice?: number; currency?: string };
      }
    | undefined;
  const normalized = rawFields.normalized as { pricePeriod?: "monthly" | "total" | null } | undefined;

  if (sourcePayload?.price?.value) {
    return {
      amount: sourcePayload.price.value,
      currency: (sourcePayload.price.currency ?? "EGP") as "EGP",
      period: sourcePayload.price.period
    };
  }

  if (sourcePayload?.developerPlan?.minPrice) {
    return {
      amount: sourcePayload.developerPlan.minPrice,
      currency: (sourcePayload.developerPlan.currency ?? "EGP") as "EGP",
      period: "total" as const
    };
  }

  return {
    amount: fallback,
    currency: "EGP" as const,
    period: normalized?.pricePeriod ?? (purpose === "rent" ? "monthly" : "total")
  };
}

@Injectable()
export class ListingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll(query?: string) {
    return this.searchClusters(query ? { query } : {});
  }

  async searchClusters(filters: SearchFilters = {}): Promise<ListingCluster[]> {
    const where = this.buildWhere(filters);
    const clusters = await this.prisma.listingCluster.findMany({
      where,
      include: {
        area: true,
        variants: {
          orderBy: {
            updatedAt: "desc"
          }
        },
        fraudCases: {
          orderBy: {
            createdAt: "desc"
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 60
    });

    return clusters.map((cluster) => this.mapCluster(cluster));
  }

  async findOne(id: string) {
    const cluster = await this.prisma.listingCluster.findUnique({
      where: { id },
      include: {
        area: true,
        variants: {
          orderBy: {
            updatedAt: "desc"
          }
        },
        fraudCases: {
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    if (!cluster) {
      throw new NotFoundException("Listing not found");
    }

    return this.mapCluster(cluster);
  }

  async findVariants(id: string): Promise<ListingVariant[]> {
    const listing = await this.findOne(id);
    return listing.variants;
  }

  async findAllByIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }

    const clusters = await this.prisma.listingCluster.findMany({
      where: {
        id: {
          in: ids
        }
      },
      include: {
        area: true,
        variants: {
          orderBy: {
            updatedAt: "desc"
          }
        },
        fraudCases: {
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    return clusters.map((cluster) => this.mapCluster(cluster));
  }

  private buildWhere(filters: SearchFilters): Prisma.ListingClusterWhereInput {
    const where: Prisma.ListingClusterWhereInput = {
      ...(filters.query
        ? {
            OR: [
              { canonicalTitleEn: { contains: filters.query, mode: "insensitive" } },
              { canonicalTitleAr: { contains: filters.query, mode: "insensitive" } },
              { area: { is: { nameEn: { contains: filters.query, mode: "insensitive" } } } },
              { area: { is: { nameAr: { contains: filters.query, mode: "insensitive" } } } }
            ]
          }
        : {}),
      ...(filters.purpose ? { purpose: filters.purpose.toUpperCase() as "RENT" | "SALE" } : {}),
      ...(filters.marketSegment
        ? { marketSegment: filters.marketSegment.toUpperCase() as "RESALE" | "PRIMARY" | "OFF_PLAN" }
        : { marketSegment: { not: "OFF_PLAN" } }),
      ...(filters.propertyTypes && filters.propertyTypes.length > 0
        ? { propertyType: { in: filters.propertyTypes } }
        : {}),
      ...(filters.areaIds && filters.areaIds.length > 0
        ? {
            area: {
              is: {
                slug: {
                  in: filters.areaIds
                }
              }
            }
          }
        : {}),
      ...(filters.bedrooms && filters.bedrooms.length > 0 ? { bedrooms: { in: filters.bedrooms } } : {}),
      ...(filters.bathrooms && filters.bathrooms.length > 0 ? { bathrooms: { in: filters.bathrooms } } : {}),
      ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
        ? {
            bestPrice: {
              ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
              ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {})
            }
          }
        : {}),
      ...(filters.minAreaSqm !== undefined || filters.maxAreaSqm !== undefined
        ? {
            areaSqm: {
              ...(filters.minAreaSqm !== undefined ? { gte: filters.minAreaSqm } : {}),
              ...(filters.maxAreaSqm !== undefined ? { lte: filters.maxAreaSqm } : {})
            }
          }
        : {})
    };

    return where;
  }

  private mapCluster(cluster: ClusterRecord): ListingCluster {
    const variants = cluster.variants.map((variant) => this.mapVariant(variant, cluster.bestPrice ?? 0, enumToPublic(cluster.purpose)));
    const firstVariant = variants[0];
    const fallbackArea = firstVariant
      ? ((cluster.variants[0]?.rawFields as { area?: { slug?: string; nameEn?: string; nameAr?: string } }).area ?? null)
      : null;
    const latestFraudCase = cluster.fraudCases[0];
    const freshnessBase = cluster.variants
      .map((variant) => variant.publishedAt ?? variant.updatedAt)
      .sort((left, right) => right.getTime() - left.getTime())[0];

    return {
      id: cluster.id,
      title: localizedText(cluster.canonicalTitleEn, cluster.canonicalTitleAr),
      price: {
        amount: cluster.bestPrice ?? 0,
        currency: "EGP",
        period: firstVariant?.price.period
      },
      purpose: enumToPublic(cluster.purpose),
      marketSegment: enumToPublic(cluster.marketSegment),
      propertyType: cluster.propertyType as ListingCluster["propertyType"],
      area: {
        id: cluster.area?.id ?? fallbackArea?.slug ?? "unknown-area",
        slug: cluster.area?.slug ?? fallbackArea?.slug ?? "unknown-area",
        name: localizedText(cluster.area?.nameEn ?? fallbackArea?.nameEn, cluster.area?.nameAr ?? fallbackArea?.nameAr)
      },
      location: firstVariant?.location,
      bedrooms: cluster.bedrooms ?? undefined,
      bathrooms: cluster.bathrooms ?? undefined,
      areaSqm: cluster.areaSqm ?? undefined,
      projectId: cluster.projectId ?? undefined,
      variantCount: variants.length,
      variants,
      fraudAssessment: {
        label: enumToPublic(cluster.fraudLabel),
        score: cluster.fraudScore,
        reasons:
          latestFraudCase && Array.isArray(latestFraudCase.explanation)
            ? (latestFraudCase.explanation as string[])
            : cluster.fraudLabel === "SAFE"
              ? ["No high-signal fraud anomalies detected yet."]
              : ["Cluster flagged for manual review based on ingestion heuristics."]
      },
      freshnessMinutes: Math.max(
        1,
        freshnessBase ? Math.round((Date.now() - freshnessBase.getTime()) / 60000) : 1
      )
    };
  }

  private mapVariant(
    variant: ClusterRecord["variants"][number],
    fallbackPrice: number,
    purpose: "rent" | "sale"
  ): ListingVariant {
    const rawFields = (variant.rawFields ?? {}) as Record<string, unknown>;
    const normalized = (rawFields.normalized ?? {}) as {
      bedrooms?: number | null;
      bathrooms?: number | null;
      areaSqm?: number | null;
      location?: unknown;
      compoundName?: { en?: string; ar?: string } | null;
      developerName?: { en?: string; ar?: string } | null;
    };
    const price = getVariantPrice(rawFields, fallbackPrice, purpose);

    return {
      id: variant.id,
      source: enumToPublic(variant.source),
      sourceListingId: variant.sourceListingId,
      sourceUrl: variant.canonicalUrl,
      title: localizedText(variant.titleEn, variant.titleAr),
      description: localizedText(variant.descriptionEn ?? variant.titleEn, variant.descriptionAr ?? variant.titleAr),
      purpose: enumToPublic(variant.purpose),
      marketSegment: enumToPublic(variant.marketSegment),
      propertyType: variant.propertyType as ListingVariant["propertyType"],
      price,
      bedrooms: normalized.bedrooms ?? undefined,
      bathrooms: normalized.bathrooms ?? undefined,
      areaSqm: normalized.areaSqm ?? undefined,
      compoundName: normalized.compoundName ? localizedText(normalized.compoundName.en, normalized.compoundName.ar) : undefined,
      developerName: normalized.developerName
        ? localizedText(normalized.developerName.en, normalized.developerName.ar)
        : undefined,
      location: toCoordinates(normalized.location),
      imageUrls: variant.imageUrls,
      publishedAt: (variant.publishedAt ?? variant.updatedAt).toISOString(),
      extractionConfidence: variant.extractionConfidence
    };
  }
}
