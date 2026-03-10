import { BasePlaywrightConnector } from "../core/base-playwright-connector.js";
import type {
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

function getPageProps(raw: RawPageResult) {
  const parsed = JSON.parse(raw.body) as {
    props?: {
      pageProps?: {
        loadedSearchResultsSSR?: {
          results?: NawyResult[];
        };
      };
    };
    loadedSearchResultsSSR?: {
      results?: NawyResult[];
    };
  };

  return parsed.props?.pageProps ?? parsed;
}

export class NawyConnector extends BasePlaywrightConnector {
  readonly source = "nawy" as const;

  async discover(): Promise<SourceSeed[]> {
    return [
      {
        url: "https://www.nawy.com/search?purpose=sale&area=new-cairo",
        label: "new-cairo-sale",
        seedKind: "discovery",
        areaSlug: "new-cairo",
        purpose: "sale",
        marketSegment: "off_plan",
        priority: 30
      }
    ];
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
}
