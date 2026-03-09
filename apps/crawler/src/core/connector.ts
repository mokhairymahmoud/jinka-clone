import { PlaywrightCrawler } from "crawlee";

import type { ListingSource, ListingVariant } from "@jinka-eg/types";

export interface SourceSeed {
  url: string;
  label: string;
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

export interface SourceConnector {
  readonly source: ListingSource;
  discover(): Promise<SourceSeed[]>;
  createCrawler(): PlaywrightCrawler;
  parse(raw: RawPageResult): Promise<Partial<ListingVariant>[]>;
  normalize(candidate: Partial<ListingVariant>): Promise<ListingVariant | null>;
  healthcheck(): Promise<ConnectorHealth>;
}
