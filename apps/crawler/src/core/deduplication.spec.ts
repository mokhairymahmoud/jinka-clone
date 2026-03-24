import { describe, expect, it } from "vitest";

import { AUTO_ATTACH_EDGE_THRESHOLD, REVIEW_EDGE_THRESHOLD, scoreDuplicateCandidate } from "./deduplication.js";

describe("scoreDuplicateCandidate", () => {
  it("auto-attaches strong duplicate signals", () => {
    const result = scoreDuplicateCandidate(
      {
        variantId: "left",
        clusterId: "cluster-left",
        source: "nawy",
        sourceListingId: "nawy-1",
        canonicalUrl: "https://example.com/listing/1",
        purpose: "sale",
        marketSegment: "off_plan",
        propertyType: "apartment",
        priceAmount: 5200000,
        bedrooms: 3,
        bathrooms: 3,
        areaSqm: 150,
        areaSlug: "new-cairo",
        citySlug: "new-cairo-city",
        governorateSlug: "cairo",
        titleEn: "Lake View Residence apartment",
        titleAr: "شقة لايك فيو ريزيدنس",
        compoundName: "Lake View Residence",
        developerName: "Developer X",
        coordinates: { lat: 30.02, lng: 31.44 },
        mediaHashes: ["image-a", "image-b"]
      },
      {
        variantId: "right",
        clusterId: "cluster-right",
        source: "property_finder",
        sourceListingId: "pf-1",
        canonicalUrl: "https://example.com/listing/1/",
        purpose: "sale",
        marketSegment: "off_plan",
        propertyType: "apartment",
        priceAmount: 5250000,
        bedrooms: 3,
        bathrooms: 3,
        areaSqm: 152,
        areaSlug: "new-cairo",
        citySlug: "new-cairo-city",
        governorateSlug: "cairo",
        titleEn: "Apartment at Lake View Residence",
        titleAr: "شقة في لايك فيو ريزيدنس",
        compoundName: "Lake View Residence",
        developerName: "Developer X",
        coordinates: { lat: 30.021, lng: 31.441 },
        mediaHashes: ["image-a", "image-c"]
      }
    );

    expect(result.score).toBeGreaterThanOrEqual(AUTO_ATTACH_EDGE_THRESHOLD);
    expect(result.decision).toBe("auto_attach");
    expect(result.reasons.some((reason) => reason.code === "same_compound")).toBe(true);
  });

  it("keeps mid-confidence matches in review", () => {
    const result = scoreDuplicateCandidate(
      {
        variantId: "left",
        clusterId: "cluster-left",
        source: "nawy",
        sourceListingId: "nawy-2",
        canonicalUrl: "https://example.com/listing/2",
        purpose: "sale",
        marketSegment: "resale",
        propertyType: "villa",
        priceAmount: 12000000,
        bedrooms: 4,
        bathrooms: 4,
        areaSqm: 240,
        areaSlug: "sheikh-zayed",
        citySlug: "sheikh-zayed-city",
        governorateSlug: "giza",
        titleEn: "Standalone villa in Beverly Hills",
        titleAr: "فيلا مستقلة في بيفرلي هيلز",
        compoundName: "Beverly Hills",
        developerName: "SODIC",
        coordinates: { lat: 30.03, lng: 30.98 },
        mediaHashes: []
      },
      {
        variantId: "right",
        clusterId: "cluster-right",
        source: "aqarmap",
        sourceListingId: "aq-2",
        canonicalUrl: "https://aqarmap.example/villa-2",
        purpose: "sale",
        marketSegment: "resale",
        propertyType: "villa",
        priceAmount: 13200000,
        bedrooms: 4,
        bathrooms: 4,
        areaSqm: 255,
        areaSlug: "sheikh-zayed",
        citySlug: "sheikh-zayed-city",
        governorateSlug: "giza",
        titleEn: "Villa for sale in Beverly Hills compound",
        titleAr: "فيلا للبيع في كمبوند بيفرلي هيلز",
        compoundName: "Beverly Hills Compound",
        developerName: "SODIC",
        coordinates: { lat: 30.034, lng: 30.975 },
        mediaHashes: []
      }
    );

    expect(result.score).toBeGreaterThanOrEqual(REVIEW_EDGE_THRESHOLD);
    expect(result.score).toBeLessThan(AUTO_ATTACH_EDGE_THRESHOLD);
    expect(result.decision).toBe("review");
  });

  it("rejects mismatched inventory", () => {
    const result = scoreDuplicateCandidate(
      {
        variantId: "left",
        source: "nawy",
        sourceListingId: "left",
        canonicalUrl: "https://example.com/rent",
        purpose: "rent",
        marketSegment: "resale",
        propertyType: "apartment",
        priceAmount: 40000,
        titleEn: "Apartment for rent",
        titleAr: "شقة للإيجار",
        mediaHashes: []
      },
      {
        variantId: "right",
        source: "property_finder",
        sourceListingId: "right",
        canonicalUrl: "https://example.com/sale",
        purpose: "sale",
        marketSegment: "off_plan",
        propertyType: "apartment",
        priceAmount: 4000000,
        titleEn: "Apartment for sale",
        titleAr: "شقة للبيع",
        mediaHashes: []
      }
    );

    expect(result.score).toBe(0);
    expect(result.decision).toBe("no_match");
  });

  it("penalizes conflicting canonical city signals", () => {
    const result = scoreDuplicateCandidate(
      {
        variantId: "left",
        source: "nawy",
        sourceListingId: "left",
        canonicalUrl: "https://example.com/left",
        purpose: "sale",
        marketSegment: "resale",
        propertyType: "apartment",
        priceAmount: 4200000,
        areaSlug: "new-cairo",
        citySlug: "new-cairo-city",
        governorateSlug: "cairo",
        titleEn: "Apartment for sale in Eastown",
        titleAr: "شقة للبيع في إيستاون",
        compoundName: "Eastown",
        mediaHashes: []
      },
      {
        variantId: "right",
        source: "property_finder",
        sourceListingId: "right",
        canonicalUrl: "https://example.com/right",
        purpose: "sale",
        marketSegment: "resale",
        propertyType: "apartment",
        priceAmount: 4200000,
        areaSlug: "zed-towers",
        citySlug: "sheikh-zayed-city",
        governorateSlug: "giza",
        titleEn: "Apartment for sale in ZED Towers",
        titleAr: "شقة للبيع في زد تاورز",
        compoundName: "ZED Towers",
        mediaHashes: []
      }
    );

    expect(result.reasons.some((reason) => reason.code === "city_conflict")).toBe(true);
    expect(result.reasons.some((reason) => reason.code === "governorate_conflict")).toBe(true);
    expect(result.decision).toBe("no_match");
  });
});
