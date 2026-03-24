import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { Coordinates, ListingCluster, ListingGeoReference, ListingVariant, SearchFilters } from "@jinka-eg/types";
import { PrismaService } from "../common/prisma.service.js";
import { SearchDocumentsService } from "../common/search-documents.service.js";

type ClusterRecord = Prisma.ListingClusterGetPayload<{
  include: {
    area: {
      include: {
        parent: {
          include: {
            parent: true;
          };
        };
      };
    };
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

function areaTypeToPublic(value?: string | null) {
  return value ? value.toLowerCase() as "governorate" | "city" | "area" : undefined;
}

function toAreaReference(
  area:
    | {
        id?: string | null;
        slug?: string | null;
        nameEn?: string | null;
        nameAr?: string | null;
        type?: string | null;
        parentId?: string | null;
      }
    | null
) {
  return {
    id: area?.id ?? area?.slug ?? "unknown-area",
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
        nameEn: string;
        nameAr: string;
        parentId: string | null;
        parent:
          | {
              id: string;
              slug: string;
              type: string;
              nameEn: string;
              nameAr: string;
              parentId: string | null;
              parent:
                | {
                    id: string;
                    slug: string;
                    type: string;
                    nameEn: string;
                    nameAr: string;
                    parentId: string | null;
                  }
                | null;
            }
          | null;
      }
    | null,
  confidence?: number
): ListingGeoReference | undefined {
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
    leaf: toAreaReference(area),
    confidence
  };
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
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SearchDocumentsService) private readonly searchDocuments: SearchDocumentsService
  ) {}

  async findAll(query?: string) {
    return this.searchClusters(query ? { query } : {});
  }

  async searchClusters(filters: SearchFilters = {}): Promise<ListingCluster[]> {
    const rows = await this.searchDocuments.searchListingClusterIds(filters);
    return this.findClustersByIds(rows.map((row) => row.clusterId));
  }

  async findOne(id: string) {
    const cluster = await this.prisma.listingCluster.findFirst({
      where: {
        id,
        variants: {
          some: {
            inactiveAt: null
          }
        }
      },
      include: {
        area: {
          include: {
            parent: {
              include: {
                parent: true
              }
            }
          }
        },
        variants: {
          where: {
            inactiveAt: null
          },
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
    return this.findClustersByIds(ids);
  }

  private async findClustersByIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }

    const clusters = await this.prisma.listingCluster.findMany({
      where: {
        id: {
          in: ids
        },
        variants: {
          some: {
            inactiveAt: null
          }
        }
      },
      include: {
        area: {
          include: {
            parent: {
              include: {
                parent: true
              }
            }
          }
        },
        variants: {
          where: {
            inactiveAt: null
          },
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

    const clusterMap = new Map(clusters.map((cluster) => [cluster.id, cluster]));
    return ids.map((id) => clusterMap.get(id)).filter((cluster): cluster is ClusterRecord => Boolean(cluster)).map((cluster) => this.mapCluster(cluster));
  }

  private mapCluster(cluster: ClusterRecord): ListingCluster {
    const variants = cluster.variants.map((variant) => this.mapVariant(variant, cluster.bestPrice ?? 0, enumToPublic(cluster.purpose)));
    const firstVariant = variants[0];
    const fallbackArea = firstVariant
      ? ((cluster.variants[0]?.rawFields as {
          area?: { id?: string; slug?: string; nameEn?: string; nameAr?: string; type?: string; parentId?: string };
          geoCanonicalization?: { confidence?: number };
        }).area ?? null)
      : null;
    const fallbackGeo = firstVariant
      ? ((cluster.variants[0]?.rawFields as { geoCanonicalization?: { confidence?: number } }).geoCanonicalization ?? null)
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
      area: cluster.area ? toAreaReference(cluster.area) : toAreaReference(fallbackArea),
      geo: buildGeoReference(cluster.area, typeof fallbackGeo?.confidence === "number" ? fallbackGeo.confidence : undefined),
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
