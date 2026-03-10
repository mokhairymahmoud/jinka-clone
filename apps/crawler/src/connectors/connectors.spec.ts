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
    const parsed = await connector.parse(getParserFixture("nawy"));

    expect(parsed.length).toBeGreaterThan(0);

    const normalized = await connector.normalize(parsed[0]);

    expect(normalized?.source).toBe("nawy");
    expect(normalized?.price.amount).toBeGreaterThan(0);
    expect(normalized?.rawFields.sourcePayload).toBeDefined();
  });

  it("parses and normalizes Property Finder fixture data", async () => {
    const connector = new PropertyFinderConnector();
    const seeds = await connector.discover();
    const parsed = await connector.parse(getParserFixture("property_finder"));

    expect(seeds.length).toBeGreaterThan(1);
    expect(seeds[0]?.label).toBe("cairo-default-p1");
    expect(seeds[1]?.page).toBe(2);
    expect(parsed.length).toBeGreaterThan(0);

    const normalized = await connector.normalize(parsed[0]);

    expect(normalized?.source).toBe("property_finder");
    expect(normalized?.bedrooms).toBeGreaterThan(0);
    expect(normalized?.location?.lng).toBeGreaterThan(0);
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
});
