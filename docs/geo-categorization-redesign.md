# Geo Categorization Redesign

## Why this document exists

The current listing geography model is centered on a single normalized area slug. That is sufficient for a small demo surface, but it is too weak for production-quality Egypt real estate categorization, filtering, alerting, and deduplication.

This document proposes a practical redesign so each listing can be categorized by:

- governorate
- city
- area
- optional district or compound when the source provides it

The design is shaped around the current repo implementation, not a blank-slate system.

## Current implementation summary

### Current flow

1. Connectors parse source-specific payloads and mostly emit one free-text `areaName`.
2. Crawler normalization calls `normalizeArea(areaName, locationHints)`.
3. `normalizeArea` either matches a very small hardcoded alias set or slugifies the free-text input.
4. Ingestion persists that result into `rawFields.area` and upserts one `Area` row keyed by `slug`.
5. `ListingCluster.areaId` and `Project.areaId` point to that flat `Area`.
6. Search documents index only `area_slug`.
7. Alerts and parts of deduplication compare area by slug.

### Current strengths

- The database already has an `Area` table with `parentId` and `geometry`.
- The crawler already persists source payloads and can be replayed.
- PostGIS is already enabled, so polygon- and point-based canonicalization is possible.
- Some sources already expose richer location structure than the current model uses.

### Current weaknesses

- `slug` is overloaded as canonical place id, hierarchy encoding, and fallback normalization output.
- Hierarchy is mostly implicit in string prefixes, not explicit in relations.
- The `Area.parentId` column is present but not populated by crawler ingestion today.
- Connectors collapse rich source location structure into a single `areaName`.
- Search and alerts are inconsistent about parent-child semantics.
- Deduplication quality is limited by the same flat geography model.

## Current code constraints

The proposal below is based on these current facts in the repo:

- `normalizeArea` returns only one flat area object with `slug`, `nameEn`, `nameAr`, and `centroid`.
- `buildNormalizedEnrichment` persists only one `area` object into raw fields.
- `upsertAreaRecord` writes only one `Area` row and does not populate `parentId`.
- `listing_search_documents` stores `area_slug` only.
- `SearchDocumentsService` simulates parent filters through slug prefix matching.
- `matchesAlertFilters` requires exact `cluster.area.slug` membership.
- Shared frontend and API types expose only flat `AreaReference` plus `areaIds`.

## Design goals

1. Categorize every listing by explicit geography levels instead of one flat slug.
2. Preserve source-level geography evidence before canonicalization.
3. Separate source extraction from canonical taxonomy assignment.
4. Support partial confidence. A listing may have governorate and city resolved even when area is uncertain.
5. Keep replay and backfill straightforward.
6. Avoid breaking current UI and search flows all at once.

## Non-goals

- This redesign does not require a dedicated external geocoding service on day one.
- This redesign does not require full polygon coverage for all Egypt areas before launch.
- This redesign does not require replacing all current `Area` references in one migration.

## Proposed target model

### Recommendation

Promote the current `Area` table into a real canonical geography table rather than introducing a second competing table immediately.

The name `Area` can remain for now, but functionally it becomes the canonical place registry for all supported geography levels.

### Proposed `Area` semantics

Each `Area` row represents one canonical geographic node, not just a leaf area.

Add these columns:

- `type`: enum with values such as `governorate`, `city`, `area`, `district`, `compound`
- `canonicalNameEn`
- `canonicalNameAr`
- `normalizedName`
- `source`
- `sourceExternalId`
- `aliases`: JSON or separate alias table
- `centroid`: optional point
- `geometry`: existing polygon column remains
- `isActive`
- `confidenceRuleVersion`

Keep these columns:

- `id`
- `slug`
- `parentId`
- `createdAt`
- `updatedAt`

### Why reuse `Area`

- It minimizes application churn.
- It preserves current relations from `ListingCluster` and `Project`.
- It lets us migrate incrementally from flat areas to hierarchy-aware canonical nodes.

## Listing-level geography model

### Target listing classification

Each listing cluster should eventually carry:

- `governorateId`
- `cityId`
- `areaId`
- `districtId` optional
- `compoundId` optional
- `locationConfidence`
- `locationSource`

### Transitional approach

If adding four or five new nullable foreign keys is too disruptive for the first step, store:

- `areaId` as the most specific canonical node
- derived ancestry in raw fields and search documents

Then add dedicated columns in a second pass if query patterns justify them.

### Recommendation

Use both:

- `areaId` as the most specific canonical node attached to the listing
- ancestor ids materialized in search documents and raw normalization fields

This gives low schema churn while still enabling hierarchy-aware filters.

## Source extraction contract

### Current problem

The current connector contract exposes only:

- `areaName?: string`

That is too lossy.

### Proposed contract addition

Add a new optional object on parsed and normalized candidates:

```ts
type ExtractedGeoNode = {
  sourceName?: string;
  sourceSlug?: string;
  sourceId?: string;
  sourceType?: string;
  level?: number;
};

type ExtractedGeoCandidate = {
  rawLabel?: string;
  rawPath?: string[];
  rawFullText?: string;
  governorate?: ExtractedGeoNode;
  city?: ExtractedGeoNode;
  area?: ExtractedGeoNode;
  district?: ExtractedGeoNode;
  compound?: ExtractedGeoNode;
  coordinates?: { lat: number; lng: number };
};
```

Keep `areaName` temporarily for compatibility, but make `extractedGeo` the new source of truth.

### Storage

Persist `extractedGeo` under `rawFields.geoExtraction`.

Persist canonicalization output under `rawFields.geoCanonicalization`.

That separation is important:

- `geoExtraction` answers what the source said
- `geoCanonicalization` answers what our system resolved

## Canonicalization pipeline

### New pipeline stages

1. Extract source geo structure.
2. Normalize source tokens.
3. Resolve each level against canonical geography.
4. Validate parent-child consistency.
5. Reconcile with coordinates when present.
6. Persist canonical result plus confidence and evidence.

### Matching strategy

Use a scoring resolver in this order:

1. Source external id exact match
2. Exact slug or alias match under the expected parent
3. Exact bilingual name match under the expected parent
4. Fuzzy text match constrained by parent and source
5. Coordinate-in-polygon match
6. Coordinate-near-centroid fallback

The resolver should prefer parent-constrained matches over globally strong fuzzy matches.

### Confidence output

For each listing, persist:

- resolved node ids
- overall confidence
- rule path used
- evidence snippets

Example:

```json
{
  "resolved": {
    "governorateId": "gov-cairo",
    "cityId": "city-new-cairo",
    "areaId": "area-fifth-settlement"
  },
  "confidence": 0.93,
  "rule": "source_tree_parent_constrained_alias",
  "evidence": {
    "rawPath": ["Cairo", "New Cairo", "Mivida"],
    "matchedAliases": ["new cairo", "القاهرة الجديدة"]
  }
}
```

## Source-specific rules

### Property Finder

This source already provides the best starting point.

Use:

- `location_tree`
- `location.path_name`
- `location.full_name`
- coordinates
- source ids and slugs

Rule set:

1. Map `location_tree` nodes into extracted hierarchy.
2. Treat source `type` values as hints, not truth. For example, top-level `CITY` values may map to governorates in our taxonomy.
3. Prefer `sourceExternalId` matching for repeated nodes.
4. Use coordinates to disambiguate cases where `New Cairo` and `New Cairo City` vary across source labels.

### Nawy

This source currently exposes much less structure.

Use:

- `areaName`
- coordinates
- compound name
- developer name

Rule set:

1. Resolve city or area from `areaName`.
2. If compound is known and mapped to a canonical area, infer its parent chain.
3. Use coordinates to promote uncertain city-level matches to area-level matches when geometry exists.

### Aqarmap

This source often provides structured hints in:

- URL path
- locality text
- structured data
- address fields

Rule set:

1. Parse ordered location segments from URL and address strings.
2. Normalize Arabic and English variants into aliases.
3. Prefer address-locality plus coordinates over title text.

### Facebook

This source is weakest and should be treated as low-confidence.

Use:

- free-text area or location label
- coordinates when present

Rule set:

1. Resolve governorate and city when confidence is high.
2. Do not force area-level assignment from weak text alone.
3. Allow partial classification with a lower confidence band.

## Search model changes

### Current issue

Search currently indexes only `area_slug` and uses prefix matching to emulate hierarchy.

### Proposed listing search document fields

Add:

- `geo_leaf_id`
- `geo_leaf_slug`
- `governorate_id`
- `city_id`
- `area_id`
- `district_id`
- `compound_id`
- `ancestor_ids`
- `ancestor_slugs`
- `governorate_name_en`
- `governorate_name_ar`
- `city_name_en`
- `city_name_ar`
- `area_name_en`
- `area_name_ar`
- `geo_confidence`

### Filter behavior

- Filtering by governorate returns all descendant cities, areas, districts, and compounds.
- Filtering by city returns all descendant areas, districts, and compounds.
- Filtering by area returns the area plus descendant districts and compounds.
- Filtering by compound is exact.

This should be implemented with explicit ancestor joins or ancestor arrays, not lexical slug prefixes.

## Alert matching changes

Alert matching should use the same hierarchy semantics as search.

Replace exact `cluster.area.slug` inclusion with:

- exact node match
- ancestor-descendant inclusion

Example:

- an alert for `New Cairo` should match `Mivida`
- an alert for `Cairo Governorate` should match `New Cairo`

This should be driven by canonical node ids, not string prefix conventions.

## Deduplication changes

The current dedupe model uses `areaSlug` as one of the comparison features.

Replace or augment it with:

- `governorateId`
- `cityId`
- `areaId`
- `compoundId`
- `geoConfidence`

Suggested scoring updates:

- same compound: stronger positive signal than same area
- same area: stronger than same city
- same city only: mild signal
- conflicting resolved geography: negative signal

This should improve merge quality where titles differ but compound and coordinates agree.

## API and type changes

### Shared type changes

Evolve the current flat `AreaReference` into a hierarchy-aware representation.

Proposed addition:

```ts
interface GeoNodeReference {
  id: string;
  slug: string;
  type: "governorate" | "city" | "area" | "district" | "compound";
  name: LocalizedText;
  parentId?: string;
}

interface ListingGeoReference {
  governorate?: GeoNodeReference;
  city?: GeoNodeReference;
  area?: GeoNodeReference;
  district?: GeoNodeReference;
  compound?: GeoNodeReference;
  leaf?: GeoNodeReference;
  confidence?: number;
}
```

### Transitional compatibility

Keep the current `listing.area` response for existing consumers, but define it as:

- the primary user-facing leaf node

Also add:

- `listing.geo`

That allows the UI to migrate gradually.

## UI changes

### Search controls

Replace one flat area picker with hierarchy-aware behavior.

Possible progression:

1. Keep one autosuggest field, but show labels like `Mivida, New Cairo, Cairo`.
2. Add type badges such as `Governorate`, `City`, `Area`, `Compound`.
3. Optionally allow stepwise filters:
   governorate -> city -> area

### Display

Listings should present:

- primary display area
- optional full breadcrumb when useful

Example:

- `Mivida, New Cairo, Cairo`
- `Sheikh Zayed City, Giza`

## Data seeding and canonical geography ownership

### Need for a curated registry

A robust rollout requires a curated Egypt geography dataset.

The canonical geography registry should own:

- governorates
- major cities
- target launch areas
- compounds where commercially important
- bilingual aliases
- source mappings
- optional polygons

### Suggested seed format

Use a seed artifact in the repo, likely JSON or CSV, with fields such as:

- `slug`
- `type`
- `nameEn`
- `nameAr`
- `parentSlug`
- `aliasesEn`
- `aliasesAr`
- `sourceMappings`
- `centroid`
- `geometry`

### Scope strategy

Do not wait for all Egypt geography.

Start with:

- Cairo
- Giza
- Alexandria
- top commercial compounds and districts in your near-term search surfaces

Expand through replay-safe backfills.

## Migration plan

### Phase 1: preserve richer source evidence

- Add `geoExtraction` and `geoCanonicalization` to raw fields.
- Update connectors to emit structured geo candidates where possible.
- No breaking API changes yet.

### Phase 2: upgrade canonical geography table

- Add `type`, aliases support, source mapping support, and centroid point support.
- Seed initial canonical hierarchy.
- Start populating `parentId`.

### Phase 3: canonicalize new listings into hierarchy

- Resolve source geography into canonical nodes during ingestion.
- Keep writing `areaId` as the leaf or best user-facing node.
- Persist ancestor ids in canonicalization payload.

### Phase 4: rebuild read models

- Extend search documents with explicit hierarchy fields.
- Switch search filters from slug-prefix logic to ancestor-aware logic.
- Align alert matching with the same logic.

### Phase 5: migrate API and UI

- Add `listing.geo`.
- Upgrade area suggestions and search controls.
- Keep existing `listing.area` for compatibility until consumers are migrated.

### Phase 6: improve dedupe and analytics

- Replace `areaSlug` dedupe features with canonical geo ids.
- Add quality metrics for unresolved or low-confidence geography.

## Backfill plan

### Inputs

Use existing replay-friendly assets:

- raw snapshots in object storage
- `ListingVariant.rawFields`
- source payloads already stored in variants

### Jobs

1. Re-run source geo extraction from stored raw payloads.
2. Re-run canonicalization against the new geography registry.
3. Update listing variant raw fields.
4. Refresh listing cluster primary geography.
5. Refresh project geography where applicable.
6. Rebuild search documents.
7. Recompute alerts if matching semantics changed.

### Ordering

Recommended order:

1. seed canonical geography
2. deploy extraction and canonicalization code
3. backfill variants
4. backfill clusters and projects
5. rebuild search documents
6. switch search and alert reads

## Observability and quality checks

Track:

- percent of listings with resolved governorate
- percent with resolved city
- percent with resolved area
- percent with compound or district
- percent unresolved by source
- percent low-confidence by source
- conflicts between text-derived and coordinate-derived hierarchy
- alert volume changes before and after hierarchy rollout

Add manual review samples for:

- top 100 most frequent unresolved labels
- top 100 ambiguous aliases
- top compounds with mismatched parent city

## Open decisions

1. Should `compound` live inside canonical geography or in a separate table linked to geography.
2. Whether aliases should be stored inline as JSON or normalized into an `AreaAlias` table.
3. Whether search should use ancestor arrays in Postgres or a dedicated search-engine document model.
4. Whether listing clusters need explicit `governorateId` and `cityId` columns, or whether `areaId` plus ancestry in search docs is enough.

## Recommendation

The right near-term path is:

1. preserve structured source geo evidence
2. turn `Area` into a true canonical geography hierarchy
3. canonicalize listings into explicit levels
4. migrate search and alerts from slug logic to hierarchy logic

The main principle is simple:

Do not use slugs to encode geography semantics. Use canonical nodes and relationships. Slugs can remain stable public identifiers, but they should no longer be the categorization model itself.
