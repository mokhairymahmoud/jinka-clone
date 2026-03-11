import type {
  ConnectorHealth,
  NormalizedListingCandidate,
  ParsedListingCandidate,
  RawPageResult,
  SourceSeed
} from "../core/connector.js";

import { BasePlaywrightConnector } from "../core/base-playwright-connector.js";
import { hashImageUrls, localizeText, normalizePrice, normalizePropertyType } from "../core/normalization.js";

export class FacebookConnector extends BasePlaywrightConnector {
  readonly source = "facebook" as const;

  override supportsDetailRefresh() {
    return true;
  }

  protected override usesBrowserFetch() {
    return true;
  }

  protected override browserFetchReadySelector() {
    return "script[data-marketplace-state]";
  }

  protected override browserFetchSettleMs() {
    return 1_500;
  }

  async discover(): Promise<SourceSeed[]> {
    return [
      {
        url: "https://www.facebook.com/marketplace/cairo/propertyrentals",
        label: "approved-public-surface",
        seedKind: "discovery",
        areaSlug: "cairo",
        purpose: "rent",
        priority: 90
      }
    ];
  }

  async parse(raw: RawPageResult): Promise<ParsedListingCandidate[]> {
    const payload = raw.payloadType === "json" ? this.safeParseJson(raw.body) : this.extractPayload(raw.body);
    const listing = this.extractListing(payload);

    if (!listing) {
      return [];
    }

    const price = normalizePrice(
      this.asNumber(listing.rentPriceMonthly ?? listing.priceAmount ?? listing.price),
      "EGP",
      "monthly"
    );

    if (!price) {
      return [];
    }

    return [
      {
        source: this.source,
        sourceListingId:
          raw.sourceListingId ?? this.asString(listing.id) ?? this.asString(listing.listingId) ?? this.extractListingId(raw.url) ?? undefined,
        sourceUrl: this.asString(listing.url) ?? raw.url,
        title: localizeText(this.asString(listing.title) ?? "Facebook Marketplace listing"),
        description: localizeText(
          this.asString(listing.description) ?? "Public or authorized Facebook Marketplace surface"
        ),
        purpose: "rent",
        marketSegment: "resale",
        propertyType: normalizePropertyType(this.asString(listing.propertyType) ?? "apartment"),
        price,
        bedrooms: this.asNumber(listing.bedrooms) ?? undefined,
        bathrooms: this.asNumber(listing.bathrooms) ?? undefined,
        areaSqm: this.asNumber(listing.areaSqm) ?? this.asNumber(listing.sizeSqm) ?? undefined,
        areaName: this.asString(listing.areaName) ?? this.asString(listing.locationName) ?? undefined,
        location: this.toCoordinates(listing.latitude, listing.longitude),
        imageUrls: this.asStringArray(listing.imageUrls),
        publishedAt: this.asString(listing.publishedAt) ?? raw.fetchedAt,
        extractionConfidence: 0.74,
        rawFields: {
          sourcePayload: listing,
          approvedSurface: "facebook_marketplace_public"
        }
      }
    ];
  }

  async normalize(candidate: ParsedListingCandidate): Promise<NormalizedListingCandidate | null> {
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
      location: candidate.location,
      areaName: candidate.areaName,
      mediaHashes: hashImageUrls(candidate.imageUrls ?? []),
      rawFields: candidate.rawFields ?? {}
    };
  }

  override async healthcheck(): Promise<ConnectorHealth> {
    return {
      source: this.source,
      status: "limited",
      parserCoverage: 0.74,
      notes: ["Public or authorized surfaces only", "No unrestricted private-profile scraping"]
    };
  }

  private extractPayload(body: string) {
    const scriptMatch = body.match(/<script[^>]+data-marketplace-state[^>]*>([\s\S]*?)<\/script>/i);
    return this.safeParseJson(scriptMatch?.[1] ?? "");
  }

  private safeParseJson(value: string) {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private extractListing(payload: Record<string, unknown> | null) {
    if (!payload) {
      return null;
    }

    if (payload.listing && typeof payload.listing === "object") {
      return payload.listing as Record<string, unknown>;
    }

    if (Array.isArray(payload.listings) && payload.listings[0] && typeof payload.listings[0] === "object") {
      return payload.listings[0] as Record<string, unknown>;
    }

    return payload;
  }

  private asString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private asNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const normalized = Number(value.replace(/[^0-9.]+/g, ""));
      return Number.isFinite(normalized) ? normalized : undefined;
    }

    return undefined;
  }

  private asStringArray(value: unknown) {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];
  }

  private toCoordinates(latitude: unknown, longitude: unknown) {
    const lat = this.asNumber(latitude);
    const lng = this.asNumber(longitude);

    return lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
  }

  private extractListingId(url: string) {
    const match = url.match(/(?:listing\/|item\/)([A-Za-z0-9_-]+)/i);
    return match?.[1];
  }
}
