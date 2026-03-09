import type { ListingVariant } from "@jinka-eg/types";

import { BasePlaywrightConnector } from "../core/base-playwright-connector.js";
import type { RawPageResult, SourceSeed } from "../core/connector.js";

export class PropertyFinderConnector extends BasePlaywrightConnector {
  readonly source = "property_finder" as const;

  async discover(): Promise<SourceSeed[]> {
    return [{ url: "https://www.propertyfinder.eg/en/search?l=1864", label: "cairo-default" }];
  }

  async parse(raw: RawPageResult): Promise<Partial<ListingVariant>[]> {
    return [
      {
        source: this.source,
        sourceListingId: raw.sourceListingId ?? "demo-pf-id",
        sourceUrl: raw.url,
        title: { en: "Parsed from Property Finder", ar: "تم التحليل من بروبرتي فايندر" },
        description: { en: "SSR or embedded JSON extraction path", ar: "مسار تحليل من SSR أو JSON" },
        purpose: "rent",
        marketSegment: "resale",
        propertyType: "apartment",
        price: { amount: 45000, currency: "EGP", period: "monthly" },
        imageUrls: [],
        publishedAt: raw.fetchedAt,
        extractionConfidence: 0.82
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
      location: candidate.location
    };
  }
}
