import { BasePlaywrightConnector } from "../core/base-playwright-connector.js";
import type {
  DiscoveryControls,
  NormalizedListingCandidate,
  ParsedListingCandidate,
  RawPageResult,
  SourceSeed
} from "../core/connector.js";
import {
  hashImageUrls,
  localizeText,
  normalizeMarketSegment,
  normalizePrice,
  normalizePropertyType,
  normalizePurpose
} from "../core/normalization.js";

type PropertyFinderListing = {
  listing_type?: string;
  property?: {
    id?: string;
    category_id?: number;
    property_type?: string;
    price?: {
      value?: number;
      currency?: string;
      period?: "monthly" | "total";
    };
    title?: string;
    description?: string;
    location?: {
      full_name?: string;
      id?: string;
      name?: string;
      path_name?: string;
      path?: string;
      slug?: string;
      type?: string;
      coordinates?: {
        lat?: number;
        lon?: number;
      };
    };
    location_tree?: PropertyFinderLocationNode[];
    images?: Array<{
      medium?: string;
      small?: string;
    }>;
    broker?: {
      name?: string;
    };
    is_direct_from_developer?: boolean;
    is_new_construction?: boolean;
    bedrooms?: string;
    bathrooms?: string;
    size?: {
      value?: number;
    };
    share_url?: string;
    reference?: string;
    listed_date?: string;
  };
};

type PropertyFinderLocationNode = {
  id?: string;
  name?: string;
  type?: string;
  slug?: string;
  slug_en?: string;
  level?: string | number;
};

type PropertyFinderPageProps = {
  filtersData?: {
    filterChoices?: {
      "filter[property_type_id]"?: Array<{ value?: string; label?: string }>;
    };
  };
  searchResult?: {
    listings?: PropertyFinderListing[];
    meta?: {
      page?: number;
      page_count?: number;
      per_page?: number;
    };
  };
};

const propertyFinderMatrix = [
  { categoryId: "2", purpose: "rent" as const, propertyType: "apartment" as const, propertyTypeId: "1" },
  { categoryId: "2", purpose: "rent" as const, propertyType: "villa" as const, propertyTypeId: "35" },
  { categoryId: "1", purpose: "sale" as const, propertyType: "apartment" as const, propertyTypeId: "1" },
  { categoryId: "1", purpose: "sale" as const, propertyType: "villa" as const, propertyTypeId: "35" },
  { categoryId: "4", purpose: "rent" as const, propertyType: "office" as const, propertyTypeId: "4" },
  { categoryId: "4", purpose: "rent" as const, propertyType: "retail" as const, propertyTypeId: "27" },
  { categoryId: "3", purpose: "sale" as const, propertyType: "office" as const, propertyTypeId: "4" },
  { categoryId: "3", purpose: "sale" as const, propertyType: "retail" as const, propertyTypeId: "27" }
] as const;

function getPageProps(raw: RawPageResult) {
  const parsed = JSON.parse(raw.body) as {
    props?: {
      pageProps?: PropertyFinderPageProps;
    };
  } & PropertyFinderPageProps;

  return parsed.props?.pageProps ?? parsed;
}

export class PropertyFinderConnector extends BasePlaywrightConnector {
  readonly source = "property_finder" as const;

  override getDiscoverySurfaceMode() {
    return "additive" as const;
  }

  async discover(): Promise<SourceSeed[]> {
    return propertyFinderMatrix.map((entry) => this.buildRootSeed(entry));
  }

  override getDiscoveryControls(
    raw: RawPageResult,
    candidates: ParsedListingCandidate[],
    seed: SourceSeed,
    previousSignature?: string | null
  ): DiscoveryControls {
    const pageProps = getPageProps(raw);
    const meta = pageProps.searchResult?.meta;
    const currentPage = seed.page ?? meta?.page ?? 1;
    const pageBudget = Number(process.env.PROPERTY_FINDER_MAX_DISCOVERY_PAGE ?? "6");
    const discoveredSeeds = this.discoverLocationSeeds(raw, seed);
    const pageSignature = candidates
      .slice(0, 10)
      .map((candidate) => candidate.sourceListingId ?? candidate.sourceUrl ?? "unknown")
      .join("|");

    if (candidates.length === 0) {
      return {
        discoveredSeeds,
        pageSignature,
        stopReason: "no_results"
      };
    }

    if (previousSignature && previousSignature === pageSignature) {
      return {
        discoveredSeeds,
        pageSignature,
        stopReason: "repeated_results"
      };
    }

    const pageCount = meta?.page_count ?? currentPage;
    if (currentPage >= pageBudget || currentPage >= pageCount) {
      return {
        discoveredSeeds,
        pageSignature,
        stopReason: currentPage >= pageBudget ? "page_budget_reached" : "page_count_reached"
      };
    }

    return {
      discoveredSeeds,
      pageSignature,
      nextSeed: {
        ...seed,
        url: this.withPage(seed.url, currentPage + 1),
        page: currentPage + 1
      }
    };
  }

  override async fetch(seed: SourceSeed) {
    const raw = await super.fetch(seed);

    if (raw.payloadType === "html") {
      const match = raw.body.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);

      if (!match) {
        throw new Error("Property Finder page is missing __NEXT_DATA__");
      }

      return {
        ...raw,
        payloadType: "json" as const,
        body: match[1]
      };
    }

    return raw;
  }

  async parse(raw: RawPageResult): Promise<ParsedListingCandidate[]> {
    const pageProps = getPageProps(raw);
    const listings = pageProps.searchResult?.listings ?? [];
    const candidates: ParsedListingCandidate[] = [];

    for (const entry of listings) {
      const property = entry.property;
      const price = normalizePrice(property?.price?.value, property?.price?.currency, property?.price?.period);

      if (!property?.id || !property.share_url || !property.title || !property.description || !price) {
        continue;
      }

      candidates.push({
        source: this.source,
        sourceListingId: property.id,
        sourceUrl: property.share_url,
        title: localizeText(property.title),
        description: localizeText(property.description),
        purpose: normalizePurpose(property.category_id),
        marketSegment: normalizeMarketSegment({
          isDirectFromDeveloper: property.is_direct_from_developer,
          isNewConstruction: property.is_new_construction
        }),
        propertyType: normalizePropertyType(property.property_type),
        price,
        bedrooms: property.bedrooms ? Number(property.bedrooms) : undefined,
        bathrooms: property.bathrooms ? Number(property.bathrooms) : undefined,
        areaSqm: property.size?.value,
        imageUrls: property.images?.map((image) => image.medium ?? image.small ?? "").filter(Boolean) ?? [],
        publishedAt: property.listed_date ?? raw.fetchedAt,
        extractionConfidence: 0.97,
        developerName: property.broker?.name ? localizeText(property.broker.name) : undefined,
        areaName: property.location?.path_name ?? property.location?.full_name,
        location:
          property.location?.coordinates?.lat && property.location?.coordinates?.lon
            ? {
                lat: property.location.coordinates.lat,
                lng: property.location.coordinates.lon
              }
            : undefined,
        rawFields: {
          reference: property.reference,
          sourcePayload: property
        }
      });
    }

    return candidates;
  }

  async normalize(candidate: ParsedListingCandidate): Promise<NormalizedListingCandidate | null> {
    if (
      !candidate.sourceListingId ||
      !candidate.sourceUrl ||
      !candidate.title ||
      !candidate.description ||
      !candidate.price
    ) {
      return null;
    }

    return {
      id: `property-finder-${candidate.sourceListingId}`,
      source: this.source,
      sourceListingId: candidate.sourceListingId,
      sourceUrl: candidate.sourceUrl,
      title: candidate.title,
      description: candidate.description,
      purpose: candidate.purpose ?? "rent",
      marketSegment: candidate.marketSegment ?? "resale",
      propertyType: candidate.propertyType ?? "apartment",
      price: candidate.price,
      imageUrls: candidate.imageUrls ?? [],
      publishedAt: candidate.publishedAt ?? new Date().toISOString(),
      extractionConfidence: candidate.extractionConfidence ?? 0.8,
      bedrooms: candidate.bedrooms,
      bathrooms: candidate.bathrooms,
      areaSqm: candidate.areaSqm,
      compoundName: candidate.compoundName,
      developerName: candidate.developerName,
      location: candidate.location,
      areaName: candidate.areaName,
      mediaHashes: hashImageUrls(candidate.imageUrls ?? []),
      rawFields: candidate.rawFields ?? {}
    };
  }

  private buildRootSeed(entry: (typeof propertyFinderMatrix)[number]): SourceSeed {
    const url = new URL("https://www.propertyfinder.eg/en/search");

    url.searchParams.set("c", entry.categoryId);
    url.searchParams.set("t", entry.propertyTypeId);
    url.searchParams.set("ob", "mr");

    return {
      source: this.source,
      url: url.toString(),
      label: `pf-${entry.categoryId}-${entry.propertyType}-root`,
      seedKind: "discovery",
      page: 1,
      purpose: entry.purpose,
      marketSegment: "resale",
      propertyType: entry.propertyType,
      priority: entry.propertyType === "apartment" || entry.propertyType === "villa" ? 20 : 30
    };
  }

  private withPage(rawUrl: string, page: number) {
    const url = new URL(rawUrl);
    url.searchParams.set("page", String(page));
    return url.toString();
  }

  private discoverLocationSeeds(raw: RawPageResult, seed: SourceSeed): SourceSeed[] {
    const categoryId = this.readParam(seed.url, "c");
    const propertyTypeId = this.readParam(seed.url, "t");
    const currentLocationId = this.readParam(seed.url, "l");

    if (!categoryId || !propertyTypeId) {
      return [];
    }

    const allowedTypes = new Set(
      (process.env.PROPERTY_FINDER_DISCOVERY_LOCATION_TYPES ?? "CITY,TOWN,DISTRICT")
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)
    );
    const perPageLimit = Number(process.env.PROPERTY_FINDER_DISCOVERY_LOCATION_LIMIT ?? "12");
    const listings = getPageProps(raw).searchResult?.listings ?? [];
    const currentLocationLevel = currentLocationId ? this.findLocationLevel(listings, currentLocationId) : null;
    const discovered = new Map<
      string,
      {
        count: number;
        node: PropertyFinderLocationNode;
      }
    >();

    for (const listing of listings) {
      for (const node of listing.property?.location_tree ?? []) {
        const nodeId = node.id;
        const nodeType = node.type?.toUpperCase();
        const nodeLevel = this.getLocationLevel(node);

        if (!nodeId || !nodeType || !allowedTypes.has(nodeType)) {
          continue;
        }

        if (currentLocationId) {
          if (nodeId === currentLocationId) {
            continue;
          }

          if (currentLocationLevel === null || nodeLevel <= currentLocationLevel) {
            continue;
          }
        }

        const existing = discovered.get(nodeId);
        if (existing) {
          existing.count += 1;
          continue;
        }

        discovered.set(nodeId, {
          count: 1,
          node
        });
      }
    }

    return [...discovered.values()]
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return this.getLocationLevel(left.node) - this.getLocationLevel(right.node);
      })
      .slice(0, perPageLimit)
      .map(({ node }) => this.buildLocationSeed(node, categoryId, propertyTypeId, seed))
      .filter((candidate): candidate is SourceSeed => Boolean(candidate));
  }

  private findLocationLevel(listings: PropertyFinderListing[], locationId: string) {
    for (const listing of listings) {
      for (const node of listing.property?.location_tree ?? []) {
        if (node.id === locationId) {
          return this.getLocationLevel(node);
        }
      }
    }

    return null;
  }

  private buildLocationSeed(
    node: PropertyFinderLocationNode,
    categoryId: string,
    propertyTypeId: string,
    parentSeed: SourceSeed
  ): SourceSeed | null {
    if (!node.id) {
      return null;
    }

    const areaSlug = this.normalizeLabel(node.slug_en ?? node.slug ?? node.name ?? node.id);
    if (!areaSlug) {
      return null;
    }

    const url = new URL("https://www.propertyfinder.eg/en/search");
    url.searchParams.set("l", node.id);
    url.searchParams.set("c", categoryId);
    url.searchParams.set("t", propertyTypeId);
    url.searchParams.set("ob", "mr");

    return {
      source: this.source,
      url: url.toString(),
      label: `pf-${categoryId}-${parentSeed.propertyType ?? propertyTypeId}-${areaSlug}`,
      seedKind: "discovery",
      areaSlug,
      page: 1,
      purpose: parentSeed.purpose,
      marketSegment: parentSeed.marketSegment,
      propertyType: parentSeed.propertyType,
      priority: Math.min((parentSeed.priority ?? 100) + 5 + this.getLocationLevel(node) * 5, 120)
    };
  }

  private getLocationLevel(node: PropertyFinderLocationNode) {
    const level =
      typeof node.level === "number"
        ? node.level
        : typeof node.level === "string"
          ? Number(node.level)
          : Number.NaN;

    return Number.isFinite(level) ? level : 0;
  }

  private normalizeLabel(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private readParam(rawUrl: string, key: string) {
    return new URL(rawUrl).searchParams.get(key) ?? undefined;
  }
}
