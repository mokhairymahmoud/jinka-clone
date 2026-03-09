import type { ConnectorHealth, RawPageResult, SourceSeed } from "../core/connector.js";
import type { ListingVariant } from "@jinka-eg/types";

import { BasePlaywrightConnector } from "../core/base-playwright-connector.js";

export class AqarmapConnector extends BasePlaywrightConnector {
  readonly source = "aqarmap" as const;

  async discover(): Promise<SourceSeed[]> {
    return [{ url: "https://aqarmap.com.eg/en/for-sale/property-type/cairo", label: "anti-bot-heavy" }];
  }

  async parse(raw: RawPageResult): Promise<Partial<ListingVariant>[]> {
    return [
      {
        source: this.source,
        sourceListingId: raw.sourceListingId ?? "demo-aqarmap-id",
        sourceUrl: raw.url,
        title: { en: "Parsed from Aqarmap", ar: "تم التحليل من عقارماب" },
        description: { en: "Protected source connector stub", ar: "موصل أولي لمصدر محمي" },
        purpose: "sale",
        marketSegment: "off_plan",
        propertyType: "apartment",
        price: { amount: 5600000, currency: "EGP", period: "total" },
        imageUrls: [],
        publishedAt: raw.fetchedAt,
        extractionConfidence: 0.7
      }
    ];
  }

  async normalize(candidate: Partial<ListingVariant>): Promise<ListingVariant | null> {
    if (!candidate.sourceListingId || !candidate.sourceUrl || !candidate.title || !candidate.description || !candidate.price) {
      return null;
    }

    return {
      id: `variant-${candidate.sourceListingId}`,
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
      extractionConfidence: candidate.extractionConfidence ?? 0.7,
      bedrooms: candidate.bedrooms,
      bathrooms: candidate.bathrooms,
      areaSqm: candidate.areaSqm,
      compoundName: candidate.compoundName,
      developerName: candidate.developerName,
      location: candidate.location
    };
  }

  override async healthcheck(): Promise<ConnectorHealth> {
    return {
      source: this.source,
      status: "degraded",
      parserCoverage: 0.73,
      notes: ["Requires residential proxies", "Fallback to operator alerts on parser drift"]
    };
  }
}
