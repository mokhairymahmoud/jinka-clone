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
    const parsed = await connector.parse(getParserFixture("property_finder"));

    expect(parsed.length).toBeGreaterThan(0);

    const normalized = await connector.normalize(parsed[0]);

    expect(normalized?.source).toBe("property_finder");
    expect(normalized?.bedrooms).toBeGreaterThan(0);
    expect(normalized?.location?.lng).toBeGreaterThan(0);
  });
});
