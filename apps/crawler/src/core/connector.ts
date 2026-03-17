import { PlaywrightCrawler } from "crawlee";

import type {
  Coordinates,
  ListingPurpose,
  ListingSource,
  ListingVariant,
  LocalizedText,
  MarketSegment,
  PriceAmount,
  PropertyType
} from "@jinka-eg/types";

export interface SourceSeed {
  url: string;
  label: string;
  source?: ListingSource;
  seedKind?: "discovery" | "detail_refresh";
  sourceListingId?: string;
  refreshVariantId?: string;
  sweepToken?: string;
  purpose?: ListingPurpose;
  marketSegment?: MarketSegment;
  propertyType?: PropertyType;
  areaSlug?: string;
  page?: number;
  priority?: number;
}

export interface DiscoveryControls {
  nextSeed?: SourceSeed;
  discoveredSeeds?: SourceSeed[];
  pageSignature?: string;
  stopReason?: string;
}

export interface RawPageResult {
  source: ListingSource;
  url: string;
  sourceListingId?: string;
  payloadType: "html" | "json";
  body: string;
  fetchedAt: string;
}

export interface ConnectorHealth {
  source: ListingSource;
  status: "healthy" | "degraded" | "limited";
  parserCoverage: number;
  notes: string[];
}

export interface ParsedListingCandidate {
  source?: ListingSource;
  sourceListingId?: string;
  sourceUrl?: string;
  title?: LocalizedText;
  description?: LocalizedText;
  purpose?: ListingPurpose;
  marketSegment?: MarketSegment;
  propertyType?: PropertyType;
  price?: PriceAmount;
  bedrooms?: number;
  bathrooms?: number;
  areaSqm?: number;
  compoundName?: LocalizedText;
  developerName?: LocalizedText;
  location?: Coordinates;
  imageUrls?: string[];
  publishedAt?: string;
  extractionConfidence?: number;
  areaName?: string;
  rawFields?: Record<string, unknown>;
}

export interface NormalizedListingCandidate extends ListingVariant {
  areaName?: string;
  mediaHashes: string[];
  rawFields: Record<string, unknown>;
}

export interface SourceConnector {
  readonly source: ListingSource;
  discover(): Promise<SourceSeed[]>;
  getDiscoverySurfaceMode(): "authoritative" | "additive";
  supportsDetailRefresh(): boolean;
  getDiscoveryControls(raw: RawPageResult, candidates: ParsedListingCandidate[], seed: SourceSeed, previousSignature?: string | null): DiscoveryControls;
  createCrawler(): PlaywrightCrawler;
  fetch(seed: SourceSeed): Promise<RawPageResult>;
  parse(raw: RawPageResult): Promise<ParsedListingCandidate[]>;
  normalize(candidate: ParsedListingCandidate): Promise<NormalizedListingCandidate | null>;
  healthcheck(): Promise<ConnectorHealth>;
}
