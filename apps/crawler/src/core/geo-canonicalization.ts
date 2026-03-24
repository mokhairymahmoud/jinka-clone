import { Prisma, PrismaClient } from "@prisma/client";

import type { Coordinates, ListingSource } from "@jinka-eg/types";
import type { ExtractedGeoCandidate, ExtractedGeoNode } from "./connector.js";

type CanonicalAreaType = "governorate" | "city" | "area";

type RegistryAreaMapping = {
  source: ListingSource;
  sourceExternalId?: string | null;
  sourceSlug?: string | null;
  sourceType?: string | null;
};

export type GeoRegistryEntry = {
  id: string;
  slug: string;
  type: CanonicalAreaType;
  nameEn: string;
  nameAr: string;
  normalizedName: string;
  parentId?: string | null;
  aliases: Array<{
    alias: string;
    normalizedAlias: string;
    locale?: string | null;
  }>;
  externalMappings: RegistryAreaMapping[];
  centroid?: Coordinates | null;
};

export type CanonicalGeoNodeReference = {
  id: string;
  slug: string;
  type: CanonicalAreaType;
  parentId?: string;
  nameEn: string;
  nameAr: string;
};

export type CanonicalGeoResolution = {
  governorate?: CanonicalGeoNodeReference;
  city?: CanonicalGeoNodeReference;
  area?: CanonicalGeoNodeReference;
  leaf?: CanonicalGeoNodeReference;
  ancestorIds: string[];
  ancestorSlugs: string[];
  confidence: number;
  rule: string;
  unresolved: string[];
  extractedGeo: ExtractedGeoCandidate;
};

type ResolveLevelInput = {
  type: CanonicalAreaType;
  source: ListingSource;
  rawNode?: ExtractedGeoNode;
  fallbackTexts?: string[];
  parentId?: string;
  registry: GeoRegistryEntry[];
};

type ResolveLevelResult = {
  match?: GeoRegistryEntry;
  confidence: number;
  rule?: string;
};

type RegistryState = {
  loadedAt: number;
  entries: GeoRegistryEntry[];
  byId: Map<string, GeoRegistryEntry>;
};

const REGISTRY_TTL_MS = 5 * 60 * 1000;

function areaTypeFromDb(value: string): CanonicalAreaType {
  switch (value.toUpperCase()) {
    case "GOVERNORATE":
      return "governorate";
    case "CITY":
      return "city";
    default:
      return "area";
  }
}

function toNodeReference(area: GeoRegistryEntry): CanonicalGeoNodeReference {
  return {
    id: area.id,
    slug: area.slug,
    type: area.type,
    parentId: area.parentId ?? undefined,
    nameEn: area.nameEn,
    nameAr: area.nameAr
  };
}

function getParent(area: GeoRegistryEntry | undefined, byId: Map<string, GeoRegistryEntry>) {
  return area?.parentId ? byId.get(area.parentId) : undefined;
}

export function normalizeGeoText(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ");
}

function tokenize(value?: string | null) {
  return normalizeGeoText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function tokenSimilarity(left?: string | null, right?: string | null) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function mergeExtractedGeo(
  extractedGeo: ExtractedGeoCandidate | undefined,
  areaName: string | undefined,
  location: Coordinates | undefined
) {
  const rawPath = extractedGeo?.rawPath?.filter(Boolean) ?? [];
  const rawLabel = extractedGeo?.rawLabel ?? areaName;
  const rawFullText = extractedGeo?.rawFullText ?? [rawLabel, ...rawPath].filter(Boolean).join(", ");

  return {
    rawLabel,
    rawPath,
    rawFullText,
    governorate: extractedGeo?.governorate,
    city: extractedGeo?.city,
    area: extractedGeo?.area,
    coordinates: extractedGeo?.coordinates ?? location
  } satisfies ExtractedGeoCandidate;
}

function collectHierarchyTexts(rawNode?: ExtractedGeoNode, fallbackTexts: string[] = []) {
  return [rawNode?.sourceName, rawNode?.sourceSlug, ...fallbackTexts].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );
}

function resolveLevel(input: ResolveLevelInput): ResolveLevelResult {
  const expectedType = input.type;
  const texts = collectHierarchyTexts(input.rawNode, input.fallbackTexts);
  const parentScoped = input.registry.filter(
    (entry) =>
      entry.type === expectedType &&
      (input.parentId ? entry.parentId === input.parentId : true)
  );
  const scope = input.parentId
    ? parentScoped
    : input.registry.filter((entry) => entry.type === expectedType);

  if (input.rawNode?.sourceId) {
    const match = scope.find((entry) =>
      entry.externalMappings.some(
        (mapping) =>
          mapping.source === input.source &&
          mapping.sourceExternalId === input.rawNode?.sourceId
      )
    );
    if (match) {
      return { match, confidence: 0.99, rule: `${expectedType}_source_id` };
    }
  }

  if (input.rawNode?.sourceSlug) {
    const normalizedSlug = input.rawNode.sourceSlug.trim().toLowerCase();
    const match = scope.find(
      (entry) =>
        entry.slug === normalizedSlug ||
        entry.externalMappings.some(
          (mapping) =>
            mapping.source === input.source &&
            mapping.sourceSlug?.trim().toLowerCase() === normalizedSlug
        )
    );
    if (match) {
      return { match, confidence: 0.96, rule: `${expectedType}_source_slug` };
    }
  }

  const normalizedTexts = texts.map((value) => normalizeGeoText(value)).filter(Boolean);
  for (const normalizedText of normalizedTexts) {
    const exact = scope.find(
      (entry) =>
        entry.normalizedName === normalizedText ||
        entry.aliases.some((alias) => alias.normalizedAlias === normalizedText)
    );
    if (exact) {
      return { match: exact, confidence: 0.92, rule: `${expectedType}_alias_exact` };
    }
  }

  let best: { entry: GeoRegistryEntry; score: number } | null = null;
  for (const entry of scope) {
    const candidates = [entry.nameEn, entry.nameAr, entry.slug, ...entry.aliases.map((alias) => alias.alias)];
    const score = Math.max(
      ...normalizedTexts.map((text) => Math.max(...candidates.map((candidate) => tokenSimilarity(text, candidate))))
    );

    if (score >= 0.74 && (!best || score > best.score)) {
      best = { entry, score };
    }
  }

  if (best) {
    return { match: best.entry, confidence: Number((0.56 + best.score * 0.25).toFixed(2)), rule: `${expectedType}_fuzzy` };
  }

  return { confidence: 0, rule: undefined };
}

export function resolveCanonicalGeoFromRegistry(args: {
  source: ListingSource;
  areaName?: string;
  extractedGeo?: ExtractedGeoCandidate;
  location?: Coordinates;
  registry: GeoRegistryEntry[];
}) {
  const extractedGeo = mergeExtractedGeo(args.extractedGeo, args.areaName, args.location);
  const byId = new Map(args.registry.map((entry) => [entry.id, entry]));
  const fallbackPath = extractedGeo.rawPath ?? [];
  const governorateResult = resolveLevel({
    type: "governorate",
    source: args.source,
    rawNode: extractedGeo.governorate,
    fallbackTexts: fallbackPath.slice(0, 1),
    registry: args.registry
  });
  const cityResult = resolveLevel({
    type: "city",
    source: args.source,
    rawNode: extractedGeo.city,
    fallbackTexts: fallbackPath.slice(1, 2).concat(extractedGeo.rawLabel ? [extractedGeo.rawLabel] : []),
    parentId: governorateResult.match?.id,
    registry: args.registry
  });
  const areaResult = resolveLevel({
    type: "area",
    source: args.source,
    rawNode: extractedGeo.area,
    fallbackTexts: fallbackPath.slice(2).concat(extractedGeo.rawLabel ? [extractedGeo.rawLabel] : []).concat(args.areaName ? [args.areaName] : []),
    parentId: cityResult.match?.id,
    registry: args.registry
  });

  const governorate =
    governorateResult.match ??
    getParent(cityResult.match, byId) ??
    getParent(getParent(areaResult.match, byId), byId);
  const city = cityResult.match ?? getParent(areaResult.match, byId);
  const area = areaResult.match;
  const leaf = area ?? city ?? governorate;

  const ancestorEntries = [governorate, city, area].filter(
    (entry, index, array): entry is GeoRegistryEntry => Boolean(entry) && array.findIndex((candidate) => candidate?.id === entry?.id) === index
  );

  const confidenceBase = [governorateResult.confidence, cityResult.confidence, areaResult.confidence].filter((value) => value > 0);
  const confidence = confidenceBase.length > 0 ? Number((confidenceBase.reduce((sum, value) => sum + value, 0) / confidenceBase.length).toFixed(2)) : 0;
  const unresolved: string[] = [];
  if (!governorate) unresolved.push("governorate");
  if (!city) unresolved.push("city");
  if (!area) unresolved.push("area");

  return {
    governorate: governorate ? toNodeReference(governorate) : undefined,
    city: city ? toNodeReference(city) : undefined,
    area: area ? toNodeReference(area) : undefined,
    leaf: leaf ? toNodeReference(leaf) : undefined,
    ancestorIds: ancestorEntries.map((entry) => entry.id),
    ancestorSlugs: ancestorEntries.map((entry) => entry.slug),
    confidence,
    rule: [governorateResult.rule, cityResult.rule, areaResult.rule].filter(Boolean).join("+") || "unresolved",
    unresolved,
    extractedGeo
  } satisfies CanonicalGeoResolution;
}

export class GeoCanonicalizer {
  private registryState: RegistryState | null = null;

  constructor(private readonly prisma: PrismaClient) {}

  async canonicalize(args: {
    source: ListingSource;
    areaName?: string;
    extractedGeo?: ExtractedGeoCandidate;
    location?: Coordinates;
  }) {
    const registryState = await this.getRegistryState();
    const initial = resolveCanonicalGeoFromRegistry({
      ...args,
      registry: registryState.entries
    });

    let governorate = initial.governorate;
    let city = initial.city;
    let area = initial.area;
    let rule = initial.rule;
    let confidence = initial.confidence;

    if (!area && args.location) {
      const nearestArea = await this.resolveByCoordinates("area", city?.id, args.location);
      if (nearestArea) {
        area = toNodeReference(nearestArea);
        city ??= nearestArea.parentId ? toNodeReference(registryState.byId.get(nearestArea.parentId) ?? nearestArea) : undefined;
        governorate ??= city?.parentId ? toNodeReference(registryState.byId.get(city.parentId) ?? nearestArea) : undefined;
        confidence = Math.max(confidence, 0.58);
        rule = `${rule}+area_coordinate`;
      }
    }

    if (!city && args.location) {
      const nearestCity = await this.resolveByCoordinates("city", governorate?.id, args.location);
      if (nearestCity) {
        city = toNodeReference(nearestCity);
        governorate ??= nearestCity.parentId ? toNodeReference(registryState.byId.get(nearestCity.parentId) ?? nearestCity) : undefined;
        confidence = Math.max(confidence, 0.52);
        rule = `${rule}+city_coordinate`;
      }
    }

    if (!governorate) {
      const govFromCity = city?.parentId ? registryState.byId.get(city.parentId) : undefined;
      const govFromArea = area?.parentId ? registryState.byId.get(area.parentId) : undefined;
      const derivedGovernorate =
        govFromCity && govFromCity.type === "governorate"
          ? govFromCity
          : govFromArea?.parentId
            ? registryState.byId.get(govFromArea.parentId)
            : undefined;

      if (derivedGovernorate) {
        governorate = toNodeReference(derivedGovernorate);
      }
    }

    const leaf = area ?? city ?? governorate;
    const ancestorRefs = [governorate, city, area].filter(
      (entry, index, array): entry is CanonicalGeoNodeReference =>
        Boolean(entry) && array.findIndex((candidate) => candidate?.id === entry?.id) === index
    );
    const unresolved = [];
    if (!governorate) unresolved.push("governorate");
    if (!city) unresolved.push("city");
    if (!area) unresolved.push("area");

    return {
      governorate,
      city,
      area,
      leaf,
      ancestorIds: ancestorRefs.map((entry) => entry.id),
      ancestorSlugs: ancestorRefs.map((entry) => entry.slug),
      confidence,
      rule,
      unresolved,
      extractedGeo: initial.extractedGeo
    } satisfies CanonicalGeoResolution;
  }

  private async getRegistryState() {
    if (this.registryState && Date.now() - this.registryState.loadedAt < REGISTRY_TTL_MS) {
      return this.registryState;
    }

    const [areas, centroids] = await Promise.all([
      this.prisma.area.findMany({
        where: { isActive: true },
        include: {
          aliases: true,
          externalMappings: true
        }
      }),
      this.prisma.$queryRaw<Array<{ id: string; lat: number | null; lng: number | null }>>`
        SELECT "id", ST_Y("centroid") AS lat, ST_X("centroid") AS lng
        FROM "Area"
        WHERE "centroid" IS NOT NULL
      `
    ]);

    const centroidMap = new Map(centroids.map((entry) => [entry.id, entry]));
    const entries = areas.map((area) => ({
      id: area.id,
      slug: area.slug,
      type: areaTypeFromDb(area.type),
      nameEn: area.nameEn,
      nameAr: area.nameAr,
      normalizedName: area.normalizedName,
      parentId: area.parentId,
      aliases: area.aliases.map((alias) => ({
        alias: alias.alias,
        normalizedAlias: alias.normalizedAlias,
        locale: alias.locale
      })),
      externalMappings: area.externalMappings.map((mapping) => ({
        source: mapping.source.toLowerCase() as ListingSource,
        sourceExternalId: mapping.sourceExternalId,
        sourceSlug: mapping.sourceSlug,
        sourceType: mapping.sourceType
      })),
      centroid:
        centroidMap.get(area.id)?.lat !== null && centroidMap.get(area.id)?.lat !== undefined
          ? {
              lat: centroidMap.get(area.id)!.lat!,
              lng: centroidMap.get(area.id)!.lng!
            }
          : null
    })) satisfies GeoRegistryEntry[];

    this.registryState = {
      loadedAt: Date.now(),
      entries,
      byId: new Map(entries.map((entry) => [entry.id, entry]))
    };

    return this.registryState;
  }

  private async resolveByCoordinates(type: CanonicalAreaType, parentId: string | undefined, coordinates: Coordinates) {
    const typeLiteral = type.toUpperCase();
    const point = Prisma.sql`ST_SetSRID(ST_MakePoint(${coordinates.lng}, ${coordinates.lat}), 4326)`;

    const polygonMatches = await this.prisma.$queryRaw<
      Array<{ id: string; slug: string; type: string; parentId: string | null; nameEn: string; nameAr: string }>
    >`
      SELECT "id", "slug", "type"::text AS "type", "parentId", "nameEn", "nameAr"
      FROM "Area"
      WHERE "isActive" = true
        AND "type" = CAST(${typeLiteral} AS "AreaType")
        AND (${parentId ?? null}::text IS NULL OR "parentId" = ${parentId ?? null})
        AND "geometry" IS NOT NULL
        AND ST_Contains("geometry", ${point})
      LIMIT 1
    `;

    const polygonMatch = polygonMatches[0];
    if (polygonMatch) {
      return {
        id: polygonMatch.id,
        slug: polygonMatch.slug,
        type: areaTypeFromDb(polygonMatch.type),
        parentId: polygonMatch.parentId,
        nameEn: polygonMatch.nameEn,
        nameAr: polygonMatch.nameAr,
        normalizedName: normalizeGeoText(polygonMatch.nameEn),
        aliases: [],
        externalMappings: []
      } satisfies GeoRegistryEntry;
    }

    const radiusMeters = type === "governorate" ? 120000 : type === "city" ? 35000 : 12000;
    const centroidMatches = await this.prisma.$queryRaw<
      Array<{ id: string; slug: string; type: string; parentId: string | null; nameEn: string; nameAr: string }>
    >`
      SELECT "id", "slug", "type"::text AS "type", "parentId", "nameEn", "nameAr"
      FROM "Area"
      WHERE "isActive" = true
        AND "type" = CAST(${typeLiteral} AS "AreaType")
        AND (${parentId ?? null}::text IS NULL OR "parentId" = ${parentId ?? null})
        AND "centroid" IS NOT NULL
        AND ST_DWithin("centroid"::geography, ${point}::geography, ${radiusMeters})
      ORDER BY ST_Distance("centroid"::geography, ${point}::geography) ASC
      LIMIT 1
    `;

    const centroidMatch = centroidMatches[0];
    if (!centroidMatch) {
      return undefined;
    }

    return {
      id: centroidMatch.id,
      slug: centroidMatch.slug,
      type: areaTypeFromDb(centroidMatch.type),
      parentId: centroidMatch.parentId,
      nameEn: centroidMatch.nameEn,
      nameAr: centroidMatch.nameAr,
      normalizedName: normalizeGeoText(centroidMatch.nameEn),
      aliases: [],
      externalMappings: []
    } satisfies GeoRegistryEntry;
  }
}
