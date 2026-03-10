import { PlaywrightCrawler } from "crawlee";

import type { ListingSource } from "@jinka-eg/types";
import type {
  ConnectorHealth,
  ParsedListingCandidate,
  RawPageResult,
  SourceConnector,
  SourceSeed
} from "./connector.js";

export abstract class BasePlaywrightConnector implements SourceConnector {
  abstract readonly source: ListingSource;

  abstract discover(): Promise<SourceSeed[]>;

  abstract parse(raw: RawPageResult): Promise<ParsedListingCandidate[]>;

  abstract normalize(candidate: ParsedListingCandidate): Promise<import("./connector.js").NormalizedListingCandidate | null>;

  supportsDetailRefresh() {
    return false;
  }

  async fetch(seed: SourceSeed): Promise<RawPageResult> {
    const response = await fetch(seed.url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${seed.url}: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";

    return {
      source: this.source,
      url: seed.url,
      sourceListingId: seed.sourceListingId,
      payloadType: contentType.includes("json") ? "json" : "html",
      body: await response.text(),
      fetchedAt: new Date().toISOString()
    };
  }

  async healthcheck(): Promise<ConnectorHealth> {
    return {
      source: this.source,
      status: "healthy",
      parserCoverage: 0.9,
      notes: ["Healthcheck stub not yet connected to runtime metrics"]
    };
  }

  createCrawler() {
    return new PlaywrightCrawler({
      headless: true,
      maxConcurrency: 2,
      async requestHandler({ request, page, log }) {
        await page.waitForLoadState("domcontentloaded");
        log.info(`Fetched ${request.url}`);
      }
    });
  }
}
