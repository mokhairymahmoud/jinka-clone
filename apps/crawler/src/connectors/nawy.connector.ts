import type { ListingVariant } from "@jinka-eg/types";

import { BasePlaywrightConnector } from "../core/base-playwright-connector.js";
import type { RawPageResult, SourceSeed } from "../core/connector.js";

export class NawyConnector extends BasePlaywrightConnector {
  readonly source = "nawy" as const;

  async discover(): Promise<SourceSeed[]> {
    return [
      { url: "https://www.nawy.com/search?purpose=sale&area=new-cairo", label: "new-cairo-sale" },
      { url: "https://www.nawy.com/search?purpose=rent&area=new-cairo", label: "new-cairo-rent" }
    ];
  }

  async parse(raw: RawPageResult): Promise<Partial<ListingVariant>[]> {
    return [
      {
        source: this.source,
        sourceListingId: raw.sourceListingId ?? "demo-nawy-id",
        sourceUrl: raw.url,
        title: { en: "Parsed from Nawy", ar: "تم التحليل من ناوي" },
        description: { en: "Connector stub output", ar: "ناتج أولي من الموصل" },
        purpose: "sale",
        marketSegment: "resale",
        propertyType: "apartment",
        price: { amount: 3000000, currency: "EGP", period: "total" },
        imageUrls: [],
        publishedAt: raw.fetchedAt,
        extractionConfidence: 0.85
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
      location: candidate.location
    };
  }
}
