import type { SearchFilters } from "@jinka-eg/types";
import { Badge } from "@jinka-eg/ui";

import { UnitsSearchWorkspace } from "../../../../../components/units-search-workspace";
import { getMessages, resolveLocale } from "../../../../../i18n/messages";
import { apiFetch } from "../../../../../lib/api";
import { getAccessTokenFromCookies } from "../../../../../lib/server-api";

type SearchPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function fetchListings(query?: string) {
  const response = await apiFetch(`/v1/listings${query ? `?${query}` : ""}`);

  if (!response.ok) {
    return [];
  }

  return response.json();
}

async function fetchFavorites() {
  const accessToken = await getAccessTokenFromCookies();

  if (!accessToken) {
    return [];
  }

  const response = await apiFetch("/v1/favorites", {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
}

async function fetchAreas() {
  const response = await apiFetch("/v1/areas");

  if (!response.ok) {
    return [];
  }

  return response.json();
}

function firstValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
}

function toStringArray(value: string | string[] | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value.flatMap((entry) => entry.split(",")) : value.split(",");
}

export default async function UnitSearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);
  const currentFilters: SearchFilters = {
    query: firstValue(resolvedSearchParams.q),
    purpose: firstValue(resolvedSearchParams.purpose) as SearchFilters["purpose"],
    marketSegment: firstValue(resolvedSearchParams.marketSegment) as SearchFilters["marketSegment"],
    propertyTypes: toStringArray(resolvedSearchParams.propertyTypes) as NonNullable<SearchFilters["propertyTypes"]>,
    areaIds: toStringArray(resolvedSearchParams.areaIds),
    bedrooms: toStringArray(resolvedSearchParams.bedrooms).map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry)),
    bathrooms: toStringArray(resolvedSearchParams.bathrooms).map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry)),
    minPrice: firstValue(resolvedSearchParams.minPrice) ? Number(firstValue(resolvedSearchParams.minPrice)) : undefined,
    maxPrice: firstValue(resolvedSearchParams.maxPrice) ? Number(firstValue(resolvedSearchParams.maxPrice)) : undefined,
    minAreaSqm: firstValue(resolvedSearchParams.minAreaSqm) ? Number(firstValue(resolvedSearchParams.minAreaSqm)) : undefined,
    maxAreaSqm: firstValue(resolvedSearchParams.maxAreaSqm) ? Number(firstValue(resolvedSearchParams.maxAreaSqm)) : undefined,
    sort: firstValue(resolvedSearchParams.sort) as SearchFilters["sort"],
    bbox:
      firstValue(resolvedSearchParams.north) &&
      firstValue(resolvedSearchParams.south) &&
      firstValue(resolvedSearchParams.east) &&
      firstValue(resolvedSearchParams.west)
        ? {
            north: Number(firstValue(resolvedSearchParams.north)),
            south: Number(firstValue(resolvedSearchParams.south)),
            east: Number(firstValue(resolvedSearchParams.east)),
            west: Number(firstValue(resolvedSearchParams.west))
          }
        : undefined
  };
  const searchQueryString = new URLSearchParams(
    Object.entries(resolvedSearchParams).flatMap(([key, value]) =>
      Array.isArray(value) ? value.map((entry) => [key, entry]) : value ? [[key, value]] : []
    )
  ).toString();
  const [listings, favorites, areas] = await Promise.all([fetchListings(searchQueryString), fetchFavorites(), fetchAreas()]);
  const favoriteIds = new Set((favorites as Array<{ clusterId: string }>).map((favorite) => favorite.clusterId));

  return (
    <div className="space-y-8">
      <Badge tone="accent">{t.units}</Badge>
      <UnitsSearchWorkspace
        locale={safeLocale}
        listings={listings as Array<Parameters<typeof UnitsSearchWorkspace>[0]["listings"][number]>}
        favoriteIds={[...favoriteIds]}
        areas={areas as Array<Parameters<typeof UnitsSearchWorkspace>[0]["areas"][number]>}
        initialFilters={currentFilters}
        mapboxToken={process.env.MAPBOX_TOKEN}
        labels={{
          title: t.searchTitle,
          body: t.searchBody,
          filters: t.filters,
          searchPlaceholder: t.searchPlaceholder,
          searchAction: t.searchAction,
          sort: t.sort,
          area: t.area,
          purpose: t.purposeLabel,
          marketSegment: t.marketSegmentLabel,
          propertyType: t.propertyTypeLabel,
          bedrooms: t.bedroomsLabel,
          bathrooms: t.bathroomsLabel,
          minPrice: t.minPriceLabel,
          maxPrice: t.maxPriceLabel,
          minArea: t.minAreaLabel,
          maxArea: t.maxAreaLabel,
          allAreas: t.allAreas,
          allPurposes: t.allPurposes,
          allSegments: t.allSegments,
          allPropertyTypes: t.allPropertyTypes,
          allBedrooms: t.allBedrooms,
          allBathrooms: t.allBathrooms,
          sortNewest: t.sortNewest,
          sortRelevance: t.sortRelevance,
          sortPriceAsc: t.sortPriceAsc,
          sortPriceDesc: t.sortPriceDesc,
          mapTitle: t.mapTitle,
          mapShow: t.mapShow,
          mapHide: t.mapHide,
          mapSearchArea: t.mapSearchArea,
          mapUnavailable: t.mapUnavailable,
          searchAreas: t.searchAreas,
          noAreasFound: t.noAreasFound,
          clearSelection: t.clearSelection
        }}
      />
    </div>
  );
}
