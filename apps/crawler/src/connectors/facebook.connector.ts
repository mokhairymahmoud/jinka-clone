import type {
  ConnectorHealth,
  DiscoveryControls,
  NormalizedListingCandidate,
  ParsedListingCandidate,
  RawPageResult,
  SourceSeed
} from "../core/connector.js";

import { BasePlaywrightConnector } from "../core/base-playwright-connector.js";
import { hashImageUrls, localizeText, normalizePrice, normalizePropertyType } from "../core/normalization.js";

const facebookAreas = [
  // { areaSlug: "cairo", label: "cairo", priority: 90 },
  // { areaSlug: "giza", label: "giza", priority: 95 },
  // { areaSlug: "alexandria", label: "alexandria", priority: 100 }
] as const;

export class FacebookConnector extends BasePlaywrightConnector {
  readonly source = "facebook" as const;

  override supportsDetailRefresh() {
    return true;
  }

  protected override usesBrowserFetch() {
    return true;
  }

  protected override browserFetchReadySelector(seed: SourceSeed) {
    if (seed.seedKind === "detail_refresh" || seed.url.includes("/marketplace/item/")) {
      return undefined;
    }

    return "a[href*='/marketplace/item/']";
  }

  protected override browserFetchSettleMs() {
    return 1_500;
  }

  async discover(): Promise<SourceSeed[]> {
    return facebookAreas.map((area) => ({
      source: this.source,
      url: `https://www.facebook.com/marketplace/${area.areaSlug}/propertyrentals`,
      label: `facebook-${area.label}-rent`,
      seedKind: "discovery",
      areaSlug: area.areaSlug,
      purpose: "rent",
      priority: area.priority
    }));
  }

  override getDiscoveryControls(
    raw: RawPageResult,
    candidates: ParsedListingCandidate[],
    seed: SourceSeed,
    previousSignature?: string | null
  ): DiscoveryControls {
    const pageSignature = candidates
      .slice(0, 10)
      .map((candidate) => candidate.sourceListingId ?? candidate.sourceUrl ?? "unknown")
      .join("|");
    const nextUrl = this.extractNextPageUrl(raw.body);
    const currentPage = seed.page ?? 1;
    const pageBudget = Number(process.env.FACEBOOK_MAX_DISCOVERY_PAGE ?? "1");

    if (candidates.length === 0) {
      const blocked = /log in to facebook|connectez-vous à facebook|marketplace isn't available/i.test(raw.body);
      return {
        pageSignature,
        stopReason: blocked ? "authorized_surface_required" : "no_results"
      };
    }

    if (previousSignature && previousSignature === pageSignature) {
      return {
        pageSignature,
        stopReason: "repeated_results"
      };
    }

    if (currentPage >= pageBudget) {
      return {
        pageSignature,
        stopReason: "page_budget_reached"
      };
    }

    if (!nextUrl) {
      return {
        pageSignature,
        stopReason: "page_count_reached"
      };
    }

    return {
      pageSignature,
      nextSeed: {
        ...seed,
        url: nextUrl,
        page: currentPage + 1
      }
    };
  }

  async parse(raw: RawPageResult): Promise<ParsedListingCandidate[]> {
    const payload = raw.payloadType === "json" ? this.safeParseJson(raw.body) : this.extractPayload(raw.body);
    const listing = this.extractListing(payload);

    if (listing) {
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
            raw.sourceListingId ??
            this.asString(listing.id) ??
            this.asString(listing.listingId) ??
            this.extractListingId(raw.url) ??
            undefined,
          sourceUrl: this.asString(listing.url) ?? raw.url,
          title: localizeText(this.asString(listing.title) ?? "Facebook Marketplace listing"),
          description: localizeText(
            this.asString(listing.description) ?? "Public or authorized Facebook Marketplace surface"
          ),
          purpose: this.inferPurpose(this.asString(listing.title), raw.url),
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

    return this.parseSearchCards(raw);
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

  private parseSearchCards(raw: RawPageResult): ParsedListingCandidate[] {
    const hrefMatches = [...raw.body.matchAll(/href="(\/marketplace\/item\/[^"]+)"/g)];

    if (hrefMatches.length === 0) {
      return [];
    }

    const candidates: ParsedListingCandidate[] = [];
    const seen = new Set<string>();

    for (let index = 0; index < hrefMatches.length; index += 1) {
      const href = hrefMatches[index]?.[1];

      if (!href) {
        continue;
      }

      const nextIndex = hrefMatches[index + 1]?.index ?? Math.min(raw.body.length, (hrefMatches[index]?.index ?? 0) + 5000);
      const start = hrefMatches[index]?.index ?? 0;
      const block = raw.body.slice(start, nextIndex);
      const sourceUrl = `https://www.facebook.com${this.decodeHtml(href).split("&")[0]}`;

      if (seen.has(sourceUrl)) {
        continue;
      }
      seen.add(sourceUrl);

      const sourceListingId = this.extractListingId(sourceUrl);
      const imageUrl = block.match(/<img[^>]+src="([^"]+)"/)?.[1];
      const texts = [...block.matchAll(/dir="auto">([^<]+)<\/span>/g)]
        .map((match) => this.cleanText(match[1]))
        .filter((value): value is string => Boolean(value));
      const priceText = texts.find((value) => /£EG|EGP|ج\.?م/i.test(value));
      const title = texts.find((value) => value !== priceText);
      const areaName = texts.find((value) => value !== priceText && value !== title);
      const purpose = this.inferPurpose(title, raw.url);
      const price = normalizePrice(this.asNumber(priceText), "EGP", purpose === "rent" ? "monthly" : "total");

      if (!sourceListingId || !title || !price) {
        continue;
      }

      candidates.push({
        source: this.source,
        sourceListingId,
        sourceUrl,
        title: localizeText(title),
        description: localizeText(areaName ? `${title} - ${areaName}` : title),
        purpose,
        marketSegment: "resale",
        propertyType: normalizePropertyType(title),
        price,
        areaName: areaName ?? undefined,
        imageUrls: imageUrl ? [imageUrl] : [],
        publishedAt: raw.fetchedAt,
        extractionConfidence: 0.61,
        rawFields: {
          sourcePayload: {
            discoveryCard: true,
            areaName
          },
          approvedSurface: "facebook_marketplace_public"
        }
      });
    }

    return candidates;
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

    return null;
  }

  private extractNextPageUrl(body: string) {
    const match = body.match(/href="([^"]*marketplace\/[^"]*(?:cursor|page|after)=[^"]+)"/i);

    if (!match?.[1]) {
      return undefined;
    }

    return `https://www.facebook.com${this.decodeHtml(match[1])}`;
  }

  private inferPurpose(title: string | undefined, url: string) {
    const haystack = `${title ?? ""} ${url}`.toLowerCase();

    if (/(for sale|للبيع|à vendre|propertyforsale|sale)/i.test(haystack)) {
      return "sale" as const;
    }

    return "rent" as const;
  }

  private cleanText(value: string) {
    return this.decodeHtml(value).replace(/\s+/g, " ").trim();
  }

  private decodeHtml(value: string) {
    return value
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#039;/g, "'")
      .replace(/&quot;/g, "\"");
  }

  private asString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private asNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const normalized = Number(this.decodeHtml(value).replace(/[^0-9.]+/g, ""));
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
