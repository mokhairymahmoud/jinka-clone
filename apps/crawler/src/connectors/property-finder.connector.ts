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
      path_name?: string;
      coordinates?: {
        lat?: number;
        lon?: number;
      };
    };
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

const propertyFinderAreas = [
  { label: "egypt", areaSlug: "egypt", locationId: "1864", priority: 20 },
  { label: "cairo", areaSlug: "cairo", locationId: "2254", priority: 25 },
  { label: "new-cairo", areaSlug: "new-cairo", locationId: "2255", priority: 25 },
  { label: "giza", areaSlug: "giza", locationId: "20663", priority: 35 },
  { label: "sheikh-zayed", areaSlug: "sheikh-zayed-city", locationId: "28683", priority: 35 }
] as const;

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

  async discover(): Promise<SourceSeed[]> {
    return propertyFinderAreas.flatMap((area) =>
      propertyFinderMatrix.map((entry) => this.buildSeed(area.locationId, area.areaSlug, area.label, area.priority, entry))
    );
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
    const pageSignature = candidates
      .slice(0, 10)
      .map((candidate) => candidate.sourceListingId ?? candidate.sourceUrl ?? "unknown")
      .join("|");

    if (candidates.length === 0) {
      return {
        pageSignature,
        stopReason: "no_results"
      };
    }

    if (previousSignature && previousSignature === pageSignature) {
      return {
        pageSignature,
        stopReason: "repeated_results"
      };
    }

    const pageCount = meta?.page_count ?? currentPage;
    if (currentPage >= pageBudget || currentPage >= pageCount) {
      return {
        pageSignature,
        stopReason: currentPage >= pageBudget ? "page_budget_reached" : "page_count_reached"
      };
    }

    return {
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

  private buildSeed(
    locationId: string,
    areaSlug: string,
    areaLabel: string,
    areaPriority: number,
    entry: (typeof propertyFinderMatrix)[number]
  ): SourceSeed {
    const url = new URL("https://www.propertyfinder.eg/en/search");

    url.searchParams.set("l", locationId);
    url.searchParams.set("c", entry.categoryId);
    url.searchParams.set("t", entry.propertyTypeId);
    url.searchParams.set("ob", "mr");

    return {
      source: this.source,
      url: url.toString(),
      label: `pf-${entry.categoryId}-${entry.propertyType}-${areaLabel}`,
      seedKind: "discovery",
      areaSlug,
      page: 1,
      purpose: entry.purpose,
      marketSegment: "resale",
      propertyType: entry.propertyType,
      priority: areaPriority + (entry.propertyType === "apartment" || entry.propertyType === "villa" ? 0 : 10)
    };
  }

  private withPage(rawUrl: string, page: number) {
    const url = new URL(rawUrl);
    url.searchParams.set("page", String(page));
    return url.toString();
  }
}
