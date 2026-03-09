import { describe, expect, it } from "vitest";

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
});
