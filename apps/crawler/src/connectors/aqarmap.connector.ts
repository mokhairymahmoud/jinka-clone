import type {
  ConnectorHealth,
  DiscoveryControls,
  NormalizedListingCandidate,
  ParsedListingCandidate,
  RawPageResult,
  SourceSeed
} from "../core/connector.js";

import { BasePlaywrightConnector } from "../core/base-playwright-connector.js";
import {
  hashImageUrls,
  localizeText,
  normalizeMarketSegment,
  normalizePrice,
  normalizePropertyType,
  normalizePurpose
} from "../core/normalization.js";

const aqarmapAreas = [
  // { label: "greater-cairo", path: ["cairo"], areaSlug: "cairo", priority: 95 },
  // { label: "new-cairo", path: ["cairo", "new-cairo"], areaSlug: "new-cairo", priority: 80 },
  // { label: "6th-of-october", path: ["cairo", "6th-of-october"], areaSlug: "6th-of-october", priority: 85 },
  // { label: "el-sheikh-zayed-city", path: ["cairo", "el-sheikh-zayed-city"], areaSlug: "el-sheikh-zayed-city", priority: 85 }
] as const;

export class AqarmapConnector extends BasePlaywrightConnector {
  readonly source = "aqarmap" as const;

  override supportsDetailRefresh() {
    return true;
  }

  protected override usesBrowserFetch() {
    return true;
  }

  protected override browserFetchReadySelector() {
    return "article.listing-card, script[type='application/ld+json']";
  }

  protected override browserFetchSettleMs() {
    return 1_500;
  }

  async discover(): Promise<SourceSeed[]> {
    return aqarmapAreas.flatMap((area) => [
      this.buildSeed("sale", area.path, area.areaSlug, area.label, area.priority),
      this.buildSeed("rent", area.path, area.areaSlug, area.label, area.priority + 5)
    ]);
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
    const currentPage = seed.page ?? this.extractPage(raw.url) ?? 1;
    const pageBudget = Number(process.env.AQARMAP_MAX_DISCOVERY_PAGE ?? "5");
    const nextUrl = this.extractNextPageUrl(raw.body);

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
    const searchCandidates = this.parseSearchCards(raw);

    if (searchCandidates.length > 0) {
      return searchCandidates;
    }

    const document = raw.payloadType === "json" ? this.safeParseJson(raw.body) : null;
    const structuredData = raw.payloadType === "html" ? this.extractStructuredData(raw.body) : [];
    const title = this.resolveTitle(raw.body, structuredData, document);
    const description = this.resolveDescription(raw.body, structuredData, document);
    const imageUrls = this.resolveImages(structuredData, document);
    const sourceUrl = this.resolveSourceUrl(raw.url, structuredData, document);
    const price = normalizePrice(
      this.resolveNumber(structuredData, document, ["offers.price", "price", "priceSpecification.price"]),
      "EGP",
      sourceUrl.includes("/rent/") ? "monthly" : "total"
    );

    if (!title || !description || !sourceUrl || !price) {
      return [];
    }

    const sourceListingId =
      raw.sourceListingId ?? this.extractListingId(sourceUrl) ?? this.extractListingId(raw.url) ?? undefined;

    return [
      {
        source: this.source,
        sourceListingId,
        sourceUrl,
        title: localizeText(title),
        description: localizeText(description),
        purpose: normalizePurpose(sourceUrl.includes("/rent/") ? "rent" : "sale"),
        marketSegment: normalizeMarketSegment({
          isOffPlan: sourceUrl.includes("/projects/") || sourceUrl.includes("/compound/")
        }),
        propertyType: normalizePropertyType(
          this.resolveString(structuredData, document, ["@type", "additionalType", "category"]) ?? "apartment"
        ),
        price,
        bedrooms: this.resolveNumber(structuredData, document, ["numberOfBedrooms", "bedrooms", "numberOfRooms"]) ?? undefined,
        bathrooms:
          this.resolveNumber(structuredData, document, ["numberOfBathroomsTotal", "bathrooms", "numberOfBathrooms"]) ?? undefined,
        areaSqm: this.resolveNumber(structuredData, document, ["floorSize.value", "floorSize", "area"]) ?? undefined,
        areaName:
          this.resolveString(structuredData, document, ["address.addressLocality", "address.addressRegion"]) ?? undefined,
        location: this.resolveCoordinates(structuredData, document),
        imageUrls,
        publishedAt: raw.fetchedAt,
        extractionConfidence: structuredData.length > 0 ? 0.78 : 0.62,
        rawFields: {
          sourcePayload: document ?? structuredData[0] ?? null,
          structuredDataCount: structuredData.length,
          antiBotLimited: true
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
      location: candidate.location,
      areaName: candidate.areaName,
      mediaHashes: hashImageUrls(candidate.imageUrls ?? []),
      rawFields: candidate.rawFields ?? {}
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

  private parseSearchCards(raw: RawPageResult): ParsedListingCandidate[] {
    if (!raw.body.includes("listing-card")) {
      return [];
    }

    const cards = [...raw.body.matchAll(/<article class="listing-card[\s\S]*?<\/article>/g)];
    const candidates: ParsedListingCandidate[] = [];
    const seen = new Set<string>();

    for (const cardMatch of cards) {
      const card = cardMatch[0];
      const href = card.match(/href="(\/en\/listing\/[^"]+)"/)?.[1];

      if (!href) {
        continue;
      }

      const sourceUrl = new URL(href, "https://aqarmap.com.eg").toString();
      if (seen.has(sourceUrl)) {
        continue;
      }
      seen.add(sourceUrl);

      const sourceListingId = this.extractListingId(sourceUrl);
      const title = this.cleanText(card.match(/<h2[^>]+title="([^"]+)"/)?.[1]);
      const location = this.cleanText(card.match(/<address[\s\S]*?title="([^"]+)"/)?.[1]);
      const priceAmount = this.asNumber(card.match(/<data value="([0-9]+)"/)?.[1]);
      const imageUrls = [...card.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1]).filter(Boolean);
      const detailValues = [...card.matchAll(/<span class="text-caption-1 text-gray__dark_2">([^<]+)<\/span>/g)].map((match) =>
        this.cleanText(match[1]) ?? ""
      );
      const price = normalizePrice(priceAmount, "EGP", raw.url.includes("/for-rent/") ? "monthly" : "total");
      const areaSqm = this.asNumber(detailValues.find((value) => value.includes("m²")));
      const bareNumbers = detailValues.map((value) => this.asNumber(value)).filter((value): value is number => value !== undefined);
      const bedrooms = bareNumbers[1];
      const bathrooms = bareNumbers[2];

      if (!sourceListingId || !title || !price) {
        continue;
      }

      candidates.push({
        source: this.source,
        sourceListingId,
        sourceUrl,
        title: localizeText(title),
        description: localizeText(location ? `${title} - ${location}` : title),
        purpose: normalizePurpose(raw.url.includes("/for-rent/") ? "rent" : "sale"),
        marketSegment: "resale",
        propertyType: normalizePropertyType(title),
        price,
        bedrooms,
        bathrooms,
        areaSqm,
        areaName: location ?? undefined,
        imageUrls: imageUrls.slice(0, 5),
        publishedAt: raw.fetchedAt,
        extractionConfidence: 0.72,
        rawFields: {
          sourcePayload: {
            discoveryCard: true,
            location
          }
        }
      });
    }

    return candidates;
  }

  private extractStructuredData(body: string) {
    const matches = [...body.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

    return matches
      .flatMap((match) => this.flattenStructuredData(this.safeParseJson(match[1])))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  }

  private flattenStructuredData(value: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(value)) {
      return value.flatMap((entry) => this.flattenStructuredData(entry));
    }

    if (!value || typeof value !== "object") {
      return [];
    }

    const record = value as Record<string, unknown>;

    if (Array.isArray(record["@graph"])) {
      return [record, ...record["@graph"].flatMap((entry) => this.flattenStructuredData(entry))];
    }

    return [record];
  }

  private safeParseJson(value: string) {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private resolveTitle(body: string, structuredData: Array<Record<string, unknown>>, document: Record<string, unknown> | null) {
    return (
      this.resolveString(structuredData, document, ["name", "headline"]) ??
      this.extractMeta(body, "property=\"og:title\"") ??
      this.extractTagTitle(body)
    );
  }

  private resolveDescription(
    body: string,
    structuredData: Array<Record<string, unknown>>,
    document: Record<string, unknown> | null
  ) {
    return (
      this.resolveString(structuredData, document, ["description"]) ??
      this.extractMeta(body, "name=\"description\"") ??
      this.extractMeta(body, "property=\"og:description\"")
    );
  }

  private resolveSourceUrl(rawUrl: string, structuredData: Array<Record<string, unknown>>, document: Record<string, unknown> | null) {
    return this.resolveString(structuredData, document, ["url", "mainEntityOfPage"]) ?? rawUrl;
  }

  private resolveImages(structuredData: Array<Record<string, unknown>>, document: Record<string, unknown> | null) {
    const rawImage = this.resolveUnknown(structuredData, document, ["image"]);

    if (typeof rawImage === "string") {
      return [rawImage];
    }

    if (Array.isArray(rawImage)) {
      return rawImage.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
    }

    return [];
  }

  private resolveCoordinates(structuredData: Array<Record<string, unknown>>, document: Record<string, unknown> | null) {
    const latitude = this.resolveNumber(structuredData, document, ["geo.latitude", "latitude"]);
    const longitude = this.resolveNumber(structuredData, document, ["geo.longitude", "longitude"]);

    return latitude !== undefined && longitude !== undefined ? { lat: latitude, lng: longitude } : undefined;
  }

  private resolveString(
    structuredData: Array<Record<string, unknown>>,
    document: Record<string, unknown> | null,
    paths: string[]
  ) {
    const value = this.resolveUnknown(structuredData, document, paths);
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private resolveNumber(
    structuredData: Array<Record<string, unknown>>,
    document: Record<string, unknown> | null,
    paths: string[]
  ) {
    const value = this.resolveUnknown(structuredData, document, paths);
    return this.asNumber(value);
  }

  private resolveUnknown(
    structuredData: Array<Record<string, unknown>>,
    document: Record<string, unknown> | null,
    paths: string[]
  ) {
    for (const path of paths) {
      for (const record of structuredData) {
        const match = this.getPath(record, path);
        if (match !== undefined && match !== null) {
          return match;
        }
      }

      if (document) {
        const match = this.getPath(document, path);
        if (match !== undefined && match !== null) {
          return match;
        }
      }
    }

    return undefined;
  }

  private getPath(record: Record<string, unknown>, path: string) {
    return path.split(".").reduce<unknown>((value, segment) => {
      if (!value || typeof value !== "object") {
        return undefined;
      }

      return (value as Record<string, unknown>)[segment];
    }, record);
  }

  private extractMeta(body: string, attribute: string) {
    const match = body.match(new RegExp(`<meta[^>]+${attribute}[^>]+content=["']([^"']+)["']`, "i"));
    return match?.[1]?.trim();
  }

  private extractTagTitle(body: string) {
    const match = body.match(/<title>([^<]+)<\/title>/i);
    return match?.[1]?.trim();
  }

  private extractListingId(url: string) {
    const match = url.match(/(?:\/|=)(\d{4,})(?:-|\/|$|\?)/);
    return match?.[1];
  }

  private buildSeed(
    purpose: "sale" | "rent",
    pathSegments: readonly string[],
    areaSlug: string,
    areaLabel: string,
    priority: number
  ): SourceSeed {
    return {
      source: this.source,
      url: `https://aqarmap.com.eg/en/for-${purpose}/property-type/${pathSegments.join("/")}/`,
      label: `aqarmap-${purpose}-${areaLabel}`,
      seedKind: "discovery",
      areaSlug,
      purpose,
      priority
    };
  }

  private extractNextPageUrl(body: string) {
    const match = body.match(/<(?:link|a)[^>]+rel="next"[^>]+href="([^"]+)"/i);

    if (!match?.[1]) {
      return undefined;
    }

    return new URL(match[1], "https://aqarmap.com.eg").toString();
  }

  private extractPage(url: string) {
    const value = new URL(url).searchParams.get("page");
    return value ? Number(value) : undefined;
  }

  private cleanText(value?: string) {
    if (!value) {
      return undefined;
    }

    return value
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
  }

  private asNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const numeric = Number(value.replace(/[^0-9.]+/g, ""));
      return Number.isFinite(numeric) ? numeric : undefined;
    }

    return undefined;
  }
}
