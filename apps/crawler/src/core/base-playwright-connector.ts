import { PlaywrightCrawler } from "crawlee";
import { chromium, type Browser } from "playwright";

import type { ListingSource } from "@jinka-eg/types";
import type {
  ConnectorHealth,
  DiscoveryControls,
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

  getDiscoveryControls(_raw: RawPageResult, _candidates: ParsedListingCandidate[], _seed: SourceSeed): DiscoveryControls {
    return {
      stopReason: "single_page_source"
    };
  }

  async fetch(seed: SourceSeed): Promise<RawPageResult> {
    if (this.usesBrowserFetch(seed)) {
      return this.fetchWithBrowser(seed);
    }

    return this.fetchWithHttp(seed);
  }

  protected usesBrowserFetch(_seed: SourceSeed) {
    return false;
  }

  protected browserFetchWaitUntil(_seed: SourceSeed): "domcontentloaded" | "networkidle" | "load" {
    return "domcontentloaded" as const;
  }

  protected browserFetchReadySelector(_seed: SourceSeed): string | undefined {
    return undefined;
  }

  protected browserFetchSettleMs(_seed: SourceSeed): number {
    return 1_500;
  }

  private async fetchWithHttp(seed: SourceSeed): Promise<RawPageResult> {
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

  private async fetchWithBrowser(seed: SourceSeed): Promise<RawPageResult> {
    let browser: Browser;

    try {
      browser = await chromium.launch({
        headless: true
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Browser-backed fetch failed to start for ${this.source}. Ensure Chromium is installed for Playwright. Original error: ${message}`
      );
    }

    try {
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        locale: "en-US",
        viewport: {
          width: 1440,
          height: 2200
        }
      });
      const page = await context.newPage();

      await page.goto(seed.url, {
        waitUntil: this.browserFetchWaitUntil(seed),
        timeout: 30_000
      });

      const selector = this.browserFetchReadySelector(seed);

      if (selector) {
        await page.waitForSelector(selector, {
          state: "attached",
          timeout: 20_000
        });
      }

      const settleMs = this.browserFetchSettleMs(seed);
      if (settleMs > 0) {
        await page.waitForTimeout(settleMs);
      }

      const body = await page.content();
      const finalUrl = page.url();

      await context.close();

      return {
        source: this.source,
        url: finalUrl,
        sourceListingId: seed.sourceListingId,
        payloadType: "html",
        body,
        fetchedAt: new Date().toISOString()
      };
    } finally {
      await browser.close();
    }
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
