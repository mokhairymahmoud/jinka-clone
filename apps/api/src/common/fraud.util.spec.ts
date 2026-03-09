import { describe, expect, it } from "vitest";

import { scoreFraud } from "./fraud.util.js";

describe("scoreFraud", () => {
  it("labels a low-signal case as safe", () => {
    const result = scoreFraud({
      priceDeviationRatio: 0.02,
      conflictingLocation: false,
      suspiciousContactReuse: false,
      imageReuseAcrossLowTrustSources: false,
      suspiciousPostingCadence: false,
      contradictoryCrossSourceData: false
    });

    expect(result.label).toBe("safe");
  });

  it("labels a high-signal case as high risk", () => {
    const result = scoreFraud({
      priceDeviationRatio: 0.7,
      conflictingLocation: true,
      suspiciousContactReuse: true,
      imageReuseAcrossLowTrustSources: true,
      suspiciousPostingCadence: true,
      contradictoryCrossSourceData: true
    });

    expect(result.label).toBe("high_risk");
  });
});
