import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { getParserFixture } from "../fixtures/index.js";
import { AqarmapConnector } from "./aqarmap.connector.js";
import { FacebookConnector } from "./facebook.connector.js";
import { NawyConnector } from "./nawy.connector.js";
import { PropertyFinderConnector } from "./property-finder.connector.js";

describe("connector health", () => {
  it("returns health metadata for all connectors", async () => {
    const connectors = [
      new NawyConnector(),
      new PropertyFinderConnector(),
      new AqarmapConnector(),
      new FacebookConnector()
    ];

    const health = await Promise.all(connectors.map((connector) => connector.healthcheck()));

    expect(health).toHaveLength(4);
    expect(health.map((item) => item.source)).toContain("nawy");
    expect(connectors.map((connector) => connector.supportsDetailRefresh())).toEqual([false, false, true, true]);
  });

  it("parses and normalizes Nawy fixture data", async () => {
    const connector = new NawyConnector();
    const seeds = await connector.discover();
    const raw = getParserFixture("nawy");
    const parsed = await connector.parse(raw);

    expect(seeds.length).toBe(8);
    expect(seeds[0]?.label).toBe("nawy-new-cairo-sale");
    expect(seeds[0]?.page).toBe(1);

    expect(parsed.length).toBeGreaterThan(0);

    const controls = connector.getDiscoveryControls(raw, parsed, seeds[0] ?? { url: "", label: "" });
    expect(controls.pageSignature).toBeTruthy();
    expect(controls.nextSeed).toBeUndefined();
    expect(controls.stopReason).toBe("page_count_reached");

    const normalized = await connector.normalize(parsed[0]);

    expect(normalized?.source).toBe("nawy");
    expect(normalized?.price.amount).toBeGreaterThan(0);
    expect(normalized?.rawFields.sourcePayload).toBeDefined();
  });

  it("parses and normalizes Property Finder fixture data", async () => {
    const connector = new PropertyFinderConnector();
    const seeds = await connector.discover();
    const raw = getParserFixture("property_finder");
    const parsed = await connector.parse(raw);

    expect(seeds.length).toBe(33);
    expect(seeds[0]?.label).toBe("pf-buy-apartment-new-cairo-city");
    expect(seeds[0]?.page).toBe(1);
    expect(parsed.length).toBeGreaterThan(0);

    const controls = connector.getDiscoveryControls(raw, parsed, seeds[0] ?? { url: "", label: "" });

    expect(controls.pageSignature).toBeTruthy();
    expect(controls.discoveredSeeds).toBeUndefined();
    if (controls.nextSeed) {
      expect(controls.nextSeed.page).toBe(2);
      expect(controls.nextSeed.url).toContain("page=2");
    } else {
      expect(controls.stopReason).toBe("page_count_reached");
    }

    const normalized = await connector.normalize(parsed[0]);

    expect(normalized?.source).toBe("property_finder");
    expect(normalized?.bedrooms).toBeGreaterThan(0);
    expect(normalized?.location?.lng).toBeGreaterThan(0);
  });

  it("uses only the static Property Finder buy apartment seed catalog", async () => {
    const connector = new PropertyFinderConnector();
    const seeds = await connector.discover();

    expect(connector.getDiscoverySurfaceMode()).toBe("authoritative");
    expect(seeds.every((seed) => seed.purpose === "sale")).toBe(true);
    expect(seeds.every((seed) => seed.propertyType === "apartment")).toBe(true);
    expect(seeds.every((seed) => seed.url.includes("/en/buy/"))).toBe(true);
    expect(seeds.every((seed) => seed.url.includes("apartments-for-sale"))).toBe(true);
  });

  it("parses and normalizes Aqarmap fixture data", async () => {
    const connector = new AqarmapConnector();
    const parsed = await connector.parse(getParserFixture("aqarmap"));

    expect(parsed.length).toBeGreaterThan(0);

    const normalized = await connector.normalize(parsed[0]);

    expect(normalized?.source).toBe("aqarmap");
    expect(normalized?.sourceListingId).toBe("987654");
    expect(normalized?.price.amount).toBe(5400000);
  });

  it("parses Aqarmap search discovery pages and paginates", async () => {
    const connector = new AqarmapConnector();
    const raw = {
      source: "aqarmap" as const,
      url: "https://aqarmap.com.eg/en/for-sale/property-type/cairo/",
      payloadType: "html" as const,
      body: readFileSync(new URL("../fixtures/aqarmap.search.html", import.meta.url), "utf8"),
      fetchedAt: "2026-03-11T00:00:00.000Z"
    };
    const seeds = await connector.discover();
    const parsed = await connector.parse(raw);

    expect(seeds.length).toBe(8);
    expect(parsed.length).toBe(2);
    expect(parsed[0]?.sourceListingId).toBe("6821540");
    expect(parsed[0]?.price?.amount).toBe(13800000);

    const controls = connector.getDiscoveryControls(raw, parsed, seeds[0] ?? { url: "", label: "" });
    expect(controls.nextSeed?.url).toContain("page=2");
    expect(controls.nextSeed?.page).toBe(2);
  });

  it("parses and normalizes Facebook fixture data", async () => {
    const connector = new FacebookConnector();
    const parsed = await connector.parse(getParserFixture("facebook"));

    expect(parsed.length).toBeGreaterThan(0);

    const normalized = await connector.normalize(parsed[0]);

    expect(normalized?.source).toBe("facebook");
    expect(normalized?.sourceListingId).toBe("fb-market-12345");
    expect(normalized?.price.amount).toBe(23000);
    expect(normalized?.areaName).toBe("New Cairo");
  });

  it("parses Facebook marketplace search pages from public HTML cards", async () => {
    const connector = new FacebookConnector();
    const raw = {
      source: "facebook" as const,
      url: "https://www.facebook.com/marketplace/cairo/propertyrentals",
      payloadType: "html" as const,
      body: readFileSync(new URL("../fixtures/facebook.marketplace.search.html", import.meta.url), "utf8"),
      fetchedAt: "2026-03-11T00:00:00.000Z"
    };
    const seeds = await connector.discover();
    const parsed = await connector.parse(raw);

    expect(seeds.length).toBe(3);
    expect(seeds[0]?.label).toBe("facebook-cairo-rent");
    expect(parsed.length).toBe(2);
    expect(parsed[0]?.sourceListingId).toBe("1219697629543252");
    expect(parsed[0]?.price?.amount).toBe(6000000);
    expect(parsed[1]?.purpose).toBe("rent");

    const controls = connector.getDiscoveryControls(raw, parsed, seeds[0] ?? { url: "", label: "" });
    expect(controls.pageSignature).toBeTruthy();
    expect(controls.nextSeed).toBeUndefined();
    expect(controls.stopReason).toBe("page_budget_reached");
  });
});
