import { describe, expect, it } from "vitest";

import { mockListings } from "@jinka-eg/fixtures";
import { scoreListingSimilarity } from "./dedup.util.js";

describe("scoreListingSimilarity", () => {
  it("returns a high score for near-identical variants", () => {
    const [left, right] = mockListings[0].variants;
    const result = scoreListingSimilarity(left, right);

    expect(result.score).toBeGreaterThan(0.7);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
