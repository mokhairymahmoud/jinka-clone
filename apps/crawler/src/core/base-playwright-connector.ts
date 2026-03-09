import { PlaywrightCrawler } from "crawlee";

import type { ListingSource, ListingVariant } from "@jinka-eg/types";
import type { ConnectorHealth, RawPageResult, SourceConnector, SourceSeed } from "./connector.js";

export abstract class BasePlaywrightConnector implements SourceConnector {
  abstract readonly source: ListingSource;

  abstract discover(): Promise<SourceSeed[]>;

  abstract parse(raw: RawPageResult): Promise<Partial<ListingVariant>[]>;

  abstract normalize(candidate: Partial<ListingVariant>): Promise<ListingVariant | null>;

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
