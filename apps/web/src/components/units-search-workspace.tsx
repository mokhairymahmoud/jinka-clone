"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ListingCluster, SearchFilters, SearchSort } from "@jinka-eg/types";
import { Card } from "@jinka-eg/ui";

import { CreateAlertForm } from "./create-alert-form";
import { FavoriteButton } from "./favorite-button";
import { ListingCard } from "./listing-card";
import { SearchMapPanel } from "./search-map-panel";

type AreaOption = {
  id: string;
  slug: string;
  name: {
    en: string;
    ar: string;
  };
};

type UnitsSearchWorkspaceProps = {
  locale: "en" | "ar";
  listings: ListingCluster[];
  areas: AreaOption[];
  favoriteIds: string[];
  initialFilters: SearchFilters;
  labels: {
    title: string;
    body: string;
    filters: string;
    searchPlaceholder: string;
    searchAction: string;
    sort: string;
    area: string;
    purpose: string;
    marketSegment: string;
    propertyType: string;
    bedrooms: string;
    bathrooms: string;
    minPrice: string;
    maxPrice: string;
    minArea: string;
    maxArea: string;
    allAreas: string;
    allPurposes: string;
    allSegments: string;
    allPropertyTypes: string;
    allBedrooms: string;
    allBathrooms: string;
    sortNewest: string;
    sortRelevance: string;
    sortPriceAsc: string;
    sortPriceDesc: string;
    mapTitle: string;
    mapShow: string;
    mapHide: string;
    mapSearchArea: string;
    mapUnavailable: string;
  };
  mapboxToken?: string;
};

function toStringArray(value?: string[] | number[]) {
  return value ? value.map((entry) => String(entry)) : [];
}

export function UnitsSearchWorkspace({
  locale,
  listings,
  areas,
  favoriteIds,
  initialFilters,
  labels,
  mapboxToken
}: UnitsSearchWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialFilters.query ?? "");
  const [sort, setSort] = useState<SearchSort>(initialFilters.sort ?? "relevance");
  const [purpose, setPurpose] = useState(initialFilters.purpose ?? "");
  const [marketSegment, setMarketSegment] = useState(initialFilters.marketSegment ?? "");
  const [propertyType, setPropertyType] = useState(initialFilters.propertyTypes?.[0] ?? "");
  const [selectedAreaIds, setSelectedAreaIds] = useState(initialFilters.areaIds ?? []);
  const [bedrooms, setBedrooms] = useState(initialFilters.bedrooms?.[0] ? String(initialFilters.bedrooms[0]) : "");
  const [bathrooms, setBathrooms] = useState(initialFilters.bathrooms?.[0] ? String(initialFilters.bathrooms[0]) : "");
  const [minPrice, setMinPrice] = useState(initialFilters.minPrice ? String(initialFilters.minPrice) : "");
  const [maxPrice, setMaxPrice] = useState(initialFilters.maxPrice ? String(initialFilters.maxPrice) : "");
  const [minArea, setMinArea] = useState(initialFilters.minAreaSqm ? String(initialFilters.minAreaSqm) : "");
  const [maxArea, setMaxArea] = useState(initialFilters.maxAreaSqm ? String(initialFilters.maxAreaSqm) : "");

  useEffect(() => {
    setQuery(initialFilters.query ?? "");
    setSort(initialFilters.sort ?? "relevance");
    setPurpose(initialFilters.purpose ?? "");
    setMarketSegment(initialFilters.marketSegment ?? "");
    setPropertyType(initialFilters.propertyTypes?.[0] ?? "");
    setSelectedAreaIds(initialFilters.areaIds ?? []);
    setBedrooms(initialFilters.bedrooms?.[0] ? String(initialFilters.bedrooms[0]) : "");
    setBathrooms(initialFilters.bathrooms?.[0] ? String(initialFilters.bathrooms[0]) : "");
    setMinPrice(initialFilters.minPrice ? String(initialFilters.minPrice) : "");
    setMaxPrice(initialFilters.maxPrice ? String(initialFilters.maxPrice) : "");
    setMinArea(initialFilters.minAreaSqm ? String(initialFilters.minAreaSqm) : "");
    setMaxArea(initialFilters.maxAreaSqm ? String(initialFilters.maxAreaSqm) : "");
  }, [initialFilters]);

  const currentFilters = useMemo<SearchFilters>(
    () => ({
      query: query || undefined,
      sort: sort || undefined,
      purpose: (purpose as SearchFilters["purpose"]) || undefined,
      marketSegment: (marketSegment as SearchFilters["marketSegment"]) || undefined,
      propertyTypes: propertyType ? [propertyType as NonNullable<SearchFilters["propertyTypes"]>[number]] : undefined,
      areaIds: selectedAreaIds.length > 0 ? selectedAreaIds : undefined,
      bedrooms: bedrooms ? [Number(bedrooms)] : undefined,
      bathrooms: bathrooms ? [Number(bathrooms)] : undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      minAreaSqm: minArea ? Number(minArea) : undefined,
      maxAreaSqm: maxArea ? Number(maxArea) : undefined,
      bbox: initialFilters.bbox
    }),
    [bathrooms, bedrooms, initialFilters.bbox, marketSegment, maxArea, maxPrice, minArea, minPrice, propertyType, purpose, query, selectedAreaIds, sort]
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();

    if (query) params.set("q", query);
    if (sort) params.set("sort", sort);
    if (purpose) params.set("purpose", purpose);
    if (marketSegment) params.set("marketSegment", marketSegment);
    if (propertyType) params.set("propertyTypes", propertyType);
    selectedAreaIds.forEach((areaId) => params.append("areaIds", areaId));
    if (bedrooms) params.set("bedrooms", bedrooms);
    if (bathrooms) params.set("bathrooms", bathrooms);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (minArea) params.set("minAreaSqm", minArea);
    if (maxArea) params.set("maxAreaSqm", maxArea);
    if (initialFilters.bbox) {
      params.set("north", String(initialFilters.bbox.north));
      params.set("south", String(initialFilters.bbox.south));
      params.set("east", String(initialFilters.bbox.east));
      params.set("west", String(initialFilters.bbox.west));
    }

    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-stone-950">{labels.title}</h1>
        <p className="mt-3 max-w-2xl text-stone-600">{labels.body}</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[360px_1fr_360px]">
        <div className="space-y-6">
          <Card className="p-5">
            <form className="grid gap-3" onSubmit={handleSubmit}>
              <div className="text-sm font-medium text-stone-500">{labels.filters}</div>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={labels.searchPlaceholder}
                className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950"
              />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <select value={sort} onChange={(event) => setSort(event.target.value as SearchSort)} className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950">
                  <option value="relevance">{labels.sortRelevance}</option>
                  <option value="newest">{labels.sortNewest}</option>
                  <option value="price_asc">{labels.sortPriceAsc}</option>
                  <option value="price_desc">{labels.sortPriceDesc}</option>
                </select>
                <select value={purpose} onChange={(event) => setPurpose(event.target.value)} className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950">
                  <option value="">{labels.allPurposes}</option>
                  <option value="sale">Sale</option>
                  <option value="rent">Rent</option>
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <select value={marketSegment} onChange={(event) => setMarketSegment(event.target.value)} className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950">
                  <option value="">{labels.allSegments}</option>
                  <option value="resale">Resale</option>
                  <option value="primary">Primary</option>
                  <option value="off_plan">Off-plan</option>
                </select>
                <select value={propertyType} onChange={(event) => setPropertyType(event.target.value)} className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950">
                  <option value="">{labels.allPropertyTypes}</option>
                  <option value="apartment">Apartment</option>
                  <option value="villa">Villa</option>
                  <option value="townhouse">Townhouse</option>
                  <option value="duplex">Duplex</option>
                  <option value="penthouse">Penthouse</option>
                  <option value="office">Office</option>
                </select>
              </div>
              <select
                multiple
                value={selectedAreaIds}
                onChange={(event) => setSelectedAreaIds(Array.from(event.target.selectedOptions).map((option) => option.value))}
                className="min-h-32 rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950"
              >
                {areas.map((area) => (
                  <option key={area.id} value={area.slug}>
                    {area.name[locale]}
                  </option>
                ))}
              </select>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <select value={bedrooms} onChange={(event) => setBedrooms(event.target.value)} className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950">
                  <option value="">{labels.allBedrooms}</option>
                  <option value="1">1+</option>
                  <option value="2">2+</option>
                  <option value="3">3+</option>
                  <option value="4">4+</option>
                </select>
                <select value={bathrooms} onChange={(event) => setBathrooms(event.target.value)} className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950">
                  <option value="">{labels.allBathrooms}</option>
                  <option value="1">1+</option>
                  <option value="2">2+</option>
                  <option value="3">3+</option>
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <input value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder={labels.minPrice} className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950" />
                <input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder={labels.maxPrice} className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <input value={minArea} onChange={(event) => setMinArea(event.target.value)} placeholder={labels.minArea} className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950" />
                <input value={maxArea} onChange={(event) => setMaxArea(event.target.value)} placeholder={labels.maxArea} className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950" />
              </div>
              <button className="rounded-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white" type="submit">
                {labels.searchAction}
              </button>
            </form>
          </Card>
          <CreateAlertForm locale={locale} initialFilters={currentFilters} areas={areas} />
        </div>
        <div className="grid gap-6">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              locale={locale}
              action={<FavoriteButton clusterId={listing.id} initialSaved={favoriteIds.includes(listing.id)} />}
            />
          ))}
        </div>
        <SearchMapPanel
          listings={listings}
          locale={locale}
          labels={{
            title: labels.mapTitle,
            open: labels.mapShow,
            close: labels.mapHide,
            searchArea: labels.mapSearchArea,
            unavailable: labels.mapUnavailable
          }}
          mapboxToken={mapboxToken}
        />
      </div>
    </div>
  );
}
