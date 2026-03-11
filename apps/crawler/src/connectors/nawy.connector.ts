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
  normalizePropertyType
} from "../core/normalization.js";

type NawyResult = {
  id: number;
  coordinates?: [number, number];
  imageUrl?: string;
  name?: string;
  slug?: string;
  areaName?: string;
  developerName?: string;
  subtitle?: string;
  propertyTypes?: Array<{ name?: string }>;
  developerPlan?: {
    minPrice?: number;
    currency?: string;
  };
};

type NawyPageProps = {
  loadedSearchResultsSSR?: {
    page?: number;
    pageSize?: number;
    total?: number;
    results?: NawyResult[];
  };
};

const nawyAreas = [
  { areaSlug: "new-cairo", label: "new-cairo", priority: 25 },
  { areaSlug: "el-sheikh-zayed", label: "el-sheikh-zayed", priority: 30 },
  { areaSlug: "6th-of-october-city", label: "6th-of-october-city", priority: 30 },
  { areaSlug: "new-capital-city", label: "new-capital-city", priority: 35 },
  { areaSlug: "mostakbal-city", label: "mostakbal-city", priority: 35 },
  { areaSlug: "ain-sokhna", label: "ain-sokhna", priority: 55 },
  { areaSlug: "ras-el-hekma", label: "ras-el-hekma", priority: 60 },
  { areaSlug: "north-coast-sahel", label: "north-coast-sahel", priority: 60 }
] as const;

function getPageProps(raw: RawPageResult) {
  const parsed = JSON.parse(raw.body) as {
    props?: {
      pageProps?: NawyPageProps;
    };
    loadedSearchResultsSSR?: NawyPageProps["loadedSearchResultsSSR"];
  };

  return parsed.props?.pageProps ?? parsed;
}

export class NawyConnector extends BasePlaywrightConnector {
  readonly source = "nawy" as const;

  async discover(): Promise<SourceSeed[]> {
    return nawyAreas.map((area) => this.buildSeed(area.areaSlug, area.label, area.priority));
  }

  override getDiscoveryControls(
    raw: RawPageResult,
    candidates: ParsedListingCandidate[],
    seed: SourceSeed,
    previousSignature?: string | null
  ): DiscoveryControls {
    const pageProps = getPageProps(raw);
    const currentPage = seed.page ?? pageProps.loadedSearchResultsSSR?.page ?? 1;
    const pageSize = pageProps.loadedSearchResultsSSR?.pageSize ?? Math.max(candidates.length, 1);
    const total = pageProps.loadedSearchResultsSSR?.total ?? candidates.length;
    const pageCount = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));
    const pageBudget = Number(process.env.NAWY_MAX_DISCOVERY_PAGE ?? "5");
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

  protected override usesBrowserFetch() {
    return true;
  }

  protected override browserFetchReadySelector() {
    return "script#__NEXT_DATA__";
  }

  protected override browserFetchSettleMs() {
    return 750;
  }

  override async fetch(seed: SourceSeed) {
    const raw = await super.fetch(seed);

    if (raw.payloadType === "html") {
      const match = raw.body.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);

      if (!match) {
        throw new Error("Nawy page is missing __NEXT_DATA__");
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
    const results = pageProps.loadedSearchResultsSSR?.results ?? [];
    const candidates: ParsedListingCandidate[] = [];

    for (const result of results) {
      const price = normalizePrice(result.developerPlan?.minPrice, result.developerPlan?.currency, "total");

      if (!result.id || !result.slug || !result.name || !price) {
        continue;
      }

      candidates.push({
        source: this.source,
        sourceListingId: String(result.id),
        sourceUrl: `https://www.nawy.com/compound/${result.slug}`,
        title: localizeText(result.name),
        description: localizeText(result.subtitle ?? result.name),
        purpose: "sale",
        marketSegment: normalizeMarketSegment({ isDirectFromDeveloper: true, isOffPlan: true }),
        propertyType: normalizePropertyType(result.propertyTypes?.[0]?.name),
        price,
        imageUrls: result.imageUrl ? [result.imageUrl] : [],
        publishedAt: raw.fetchedAt,
        extractionConfidence: 0.95,
        developerName: result.developerName ? localizeText(result.developerName) : undefined,
        compoundName: localizeText(result.name),
        areaName: result.areaName,
        location:
          result.coordinates && result.coordinates.length === 2
            ? { lat: result.coordinates[1], lng: result.coordinates[0] }
            : undefined,
        rawFields: {
          sourcePayload: result
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
      id: `nawy-${candidate.sourceListingId}`,
      source: this.source,
      sourceListingId: candidate.sourceListingId,
      sourceUrl: candidate.sourceUrl,
      title: candidate.title,
      description: candidate.description,
      purpose: candidate.purpose ?? "sale",
      marketSegment: candidate.marketSegment ?? "off_plan",
      propertyType: candidate.propertyType ?? "apartment",
      price: candidate.price,
      imageUrls: candidate.imageUrls ?? [],
      publishedAt: candidate.publishedAt ?? new Date().toISOString(),
      extractionConfidence: candidate.extractionConfidence ?? 0.95,
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

  private buildSeed(areaSlug: string, label: string, priority: number): SourceSeed {
    const url = new URL("https://www.nawy.com/search");
    url.searchParams.set("purpose", "sale");
    url.searchParams.set("area", areaSlug);

    return {
      source: this.source,
      url: url.toString(),
      label: `nawy-${label}-sale`,
      seedKind: "discovery",
      areaSlug,
      page: 1,
      purpose: "sale",
      marketSegment: "off_plan",
      priority
    };
  }

  private withPage(rawUrl: string, page: number) {
    const url = new URL(rawUrl);
    url.searchParams.set("page", String(page));
    return url.toString();
  }
}
