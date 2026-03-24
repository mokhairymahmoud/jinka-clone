import { describe, expect, it, vi } from "vitest";

import { GeoCanonicalizer, normalizeGeoText, resolveCanonicalGeoFromRegistry } from "./geo-canonicalization.js";

const registry = [
  {
    id: "gov-cairo",
    slug: "cairo",
    type: "governorate" as const,
    nameEn: "Cairo",
    nameAr: "القاهرة",
    normalizedName: normalizeGeoText("Cairo"),
    parentId: null,
    aliases: [{ alias: "القاهرة", normalizedAlias: normalizeGeoText("القاهرة"), locale: "ar" }],
    externalMappings: [{ source: "property_finder" as const, sourceExternalId: "2254", sourceSlug: "cairo", sourceType: "CITY" }],
    centroid: { lat: 30.0444, lng: 31.2357 }
  },
  {
    id: "city-new-cairo",
    slug: "new-cairo-city",
    type: "city" as const,
    nameEn: "New Cairo City",
    nameAr: "مدينة القاهرة الجديدة",
    normalizedName: normalizeGeoText("New Cairo City"),
    parentId: "gov-cairo",
    aliases: [{ alias: "new cairo", normalizedAlias: normalizeGeoText("new cairo"), locale: "en" }],
    externalMappings: [{ source: "property_finder" as const, sourceExternalId: "2255", sourceSlug: "new-cairo-city", sourceType: "TOWN" }],
    centroid: { lat: 30.0155, lng: 31.4913 }
  },
  {
    id: "gov-alexandria",
    slug: "alexandria",
    type: "governorate" as const,
    nameEn: "Alexandria",
    nameAr: "الإسكندرية",
    normalizedName: normalizeGeoText("Alexandria"),
    parentId: null,
    aliases: [{ alias: "alexandria", normalizedAlias: normalizeGeoText("alexandria"), locale: "en" }],
    externalMappings: [],
    centroid: { lat: 31.2001, lng: 29.9187 }
  },
  {
    id: "city-alexandria",
    slug: "alexandria-city",
    type: "city" as const,
    nameEn: "Alexandria City",
    nameAr: "مدينة الإسكندرية",
    normalizedName: normalizeGeoText("Alexandria City"),
    parentId: "gov-alexandria",
    aliases: [{ alias: "alexandria", normalizedAlias: normalizeGeoText("alexandria"), locale: "en" }],
    externalMappings: [],
    centroid: { lat: 31.2001, lng: 29.9187 }
  },
  {
    id: "area-new-cairo",
    slug: "new-cairo",
    type: "area" as const,
    nameEn: "New Cairo",
    nameAr: "القاهرة الجديدة",
    normalizedName: normalizeGeoText("New Cairo"),
    parentId: "city-new-cairo",
    aliases: [{ alias: "new cairo", normalizedAlias: normalizeGeoText("new cairo"), locale: "en" }],
    externalMappings: [{ source: "facebook" as const, sourceSlug: "new-cairo", sourceType: "AREA" }],
    centroid: { lat: 30.0155, lng: 31.4913 }
  },
  {
    id: "area-mivida",
    slug: "mivida",
    type: "area" as const,
    nameEn: "Mivida",
    nameAr: "ميفيدا",
    normalizedName: normalizeGeoText("Mivida"),
    parentId: "city-new-cairo",
    aliases: [{ alias: "mivida", normalizedAlias: normalizeGeoText("mivida"), locale: "en" }],
    externalMappings: [{ source: "property_finder" as const, sourceExternalId: "99999", sourceSlug: "new-cairo-mivida", sourceType: "COMPOUND" }],
    centroid: { lat: 30.0187, lng: 31.4911 }
  }
];

describe("resolveCanonicalGeoFromRegistry", () => {
  it("prefers exact source external id matches", () => {
    const result = resolveCanonicalGeoFromRegistry({
      source: "property_finder",
      extractedGeo: {
        rawLabel: "Mivida",
        rawPath: ["Cairo", "New Cairo", "Mivida"],
        governorate: { sourceId: "2254", sourceName: "Cairo" },
        city: { sourceId: "2255", sourceName: "New Cairo City" },
        area: { sourceId: "99999", sourceName: "Mivida" }
      },
      registry
    });

    expect(result.governorate?.slug).toBe("cairo");
    expect(result.city?.slug).toBe("new-cairo-city");
    expect(result.area?.slug).toBe("mivida");
    expect(result.rule).toContain("area_source_id");
  });

  it("resolves aliases under the expected parent", () => {
    const result = resolveCanonicalGeoFromRegistry({
      source: "facebook",
      areaName: "New Cairo",
      extractedGeo: {
        rawLabel: "New Cairo",
        rawPath: ["Cairo", "New Cairo"],
        governorate: { sourceName: "Cairo" },
        city: { sourceName: "New Cairo" },
        area: { sourceName: "New Cairo" }
      },
      registry
    });

    expect(result.governorate?.slug).toBe("cairo");
    expect(result.city?.slug).toBe("new-cairo-city");
    expect(result.area?.slug).toBe("new-cairo");
    expect(result.rule).toContain("city_alias_exact");
  });

  it("does not force an area match under the wrong parent", () => {
    const result = resolveCanonicalGeoFromRegistry({
      source: "facebook",
      extractedGeo: {
        rawLabel: "Mivida",
        rawPath: ["Alexandria", "Mivida"],
        governorate: { sourceName: "Alexandria" },
        city: { sourceName: "Alexandria" },
        area: { sourceName: "Mivida" }
      },
      registry
    });

    expect(result.city?.slug).toBe("alexandria-city");
    expect(result.area).toBeUndefined();
  });
});

describe("GeoCanonicalizer", () => {
  it("falls back to coordinates when text is weak", async () => {
    const prisma = {
      area: {
        findMany: vi.fn().mockResolvedValue(
          registry.map((entry) => ({
            id: entry.id,
            slug: entry.slug,
            type: entry.type.toUpperCase(),
            nameEn: entry.nameEn,
            nameAr: entry.nameAr,
            normalizedName: entry.normalizedName,
            parentId: entry.parentId,
            aliases: entry.aliases,
            externalMappings: entry.externalMappings.map((mapping) => ({
              source: mapping.source.toUpperCase(),
              sourceExternalId: "sourceExternalId" in mapping ? mapping.sourceExternalId : undefined,
              sourceSlug: "sourceSlug" in mapping ? mapping.sourceSlug : undefined,
              sourceType: "sourceType" in mapping ? mapping.sourceType : undefined
            }))
          }))
        )
      },
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce(
          registry.map((entry) => ({
            id: entry.id,
            lat: entry.centroid?.lat ?? null,
            lng: entry.centroid?.lng ?? null
          }))
        )
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: "area-mivida",
            slug: "mivida",
            type: "AREA",
            parentId: "city-new-cairo",
            nameEn: "Mivida",
            nameAr: "ميفيدا"
          }
        ])
    };

    const canonicalizer = new GeoCanonicalizer(prisma as never);
    const result = await canonicalizer.canonicalize({
      source: "property_finder",
      extractedGeo: {
        rawLabel: "Unknown compound",
        rawPath: ["Cairo", "New Cairo", "Unknown compound"],
        governorate: { sourceName: "Cairo" },
        city: { sourceName: "New Cairo" }
      },
      location: { lat: 30.0187, lng: 31.4911 }
    });

    expect(result.city?.slug).toBe("new-cairo-city");
    expect(result.area?.slug).toBe("mivida");
    expect(result.rule).toContain("area_coordinate");
  });
});
