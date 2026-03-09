import type { ConnectorHealth, RawPageResult, SourceSeed } from "../core/connector.js";
import type { ListingVariant } from "@jinka-eg/types";

import { BasePlaywrightConnector } from "../core/base-playwright-connector.js";

export class FacebookConnector extends BasePlaywrightConnector {
  readonly source = "facebook" as const;

  async discover(): Promise<SourceSeed[]> {
    return [{ url: "https://www.facebook.com/marketplace/cairo/propertyrentals", label: "approved-public-surface" }];
  }

  async parse(raw: RawPageResult): Promise<Partial<ListingVariant>[]> {
    return [
      {
        source: this.source,
        sourceListingId: raw.sourceListingId ?? "demo-facebook-id",
        sourceUrl: raw.url,
        title: { en: "Parsed from Facebook", ar: "تم التحليل من فيسبوك" },
        description: { en: "Public or authorized surface only", ar: "الأسطح العامة أو المصرح بها فقط" },
        purpose: "rent",
        marketSegment: "resale",
        propertyType: "apartment",
        price: { amount: 22000, currency: "EGP", period: "monthly" },
        imageUrls: [],
        publishedAt: raw.fetchedAt,
        extractionConfidence: 0.62
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
      extractionConfidence: candidate.extractionConfidence ?? 0.62,
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
      status: "limited",
      parserCoverage: 0.68,
      notes: ["Public or authorized surfaces only", "No unrestricted private-profile scraping"]
    };
  }
}
