import { describe, expect, it } from "vitest";

import { hasMatchingAncestorSlug, toSearchDocumentMarketSegment, toSearchDocumentPurpose } from "./search-documents.service.js";

describe("search document enum normalization", () => {
  it("maps lowercase public purpose values to search document enum values", () => {
    expect(toSearchDocumentPurpose("sale")).toBe("SALE");
    expect(toSearchDocumentPurpose("rent")).toBe("RENT");
  });

  it("maps lowercase public market segment values to search document enum values", () => {
    expect(toSearchDocumentMarketSegment("resale")).toBe("RESALE");
    expect(toSearchDocumentMarketSegment("primary")).toBe("PRIMARY");
    expect(toSearchDocumentMarketSegment("off_plan")).toBe("OFF_PLAN");
  });

  it("supports parent area filters through explicit ancestor slugs", () => {
    const ancestorSlugs = ["alexandria", "alexandria-city", "hay-than-el-montazah"];

    expect(hasMatchingAncestorSlug(ancestorSlugs, "alexandria")).toBe(true);
    expect(hasMatchingAncestorSlug(ancestorSlugs, "alexandria-city")).toBe(true);
    expect(hasMatchingAncestorSlug(ancestorSlugs, "giza")).toBe(false);
  });
});
