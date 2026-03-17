"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ListingCluster } from "@jinka-eg/types";

type SearchMapPanelProps = {
  listings: ListingCluster[];
  locale: "en" | "ar";
  labels: {
    title: string;
    open: string;
    close: string;
    searchArea: string;
    unavailable: string;
  };
  mapboxToken?: string;
};

const fallbackCenter = { lat: 30.0444, lng: 31.2357 };

function averageCenter(listings: ListingCluster[]) {
  const locations = listings.map((listing) => listing.location).filter((location): location is NonNullable<ListingCluster["location"]> => Boolean(location));

  if (locations.length === 0) {
    return fallbackCenter;
  }

  const total = locations.reduce(
    (acc, location) => ({
      lat: acc.lat + location.lat,
      lng: acc.lng + location.lng
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: total.lat / locations.length,
    lng: total.lng / locations.length
  };
}

export function SearchMapPanel({ listings, locale, labels, mapboxToken }: SearchMapPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const markersRef = useRef<Array<{ remove: () => void }>>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mapMoved, setMapMoved] = useState(false);

  const center = useMemo(() => averageCenter(listings), [listings]);

  useEffect(() => {
    if (!mapboxToken || !mapRef.current) {
      return;
    }

    let cancelled = false;

    void import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelled || !mapRef.current) {
        return;
      }

      mapboxgl.accessToken = mapboxToken;

      const map = new mapboxgl.Map({
        container: mapRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [center.lng, center.lat],
        zoom: listings.length > 0 ? 9 : 6
      });

      map.addControl(new mapboxgl.NavigationControl(), locale === "ar" ? "top-left" : "top-right");
      map.on("moveend", () => setMapMoved(true));
      mapInstanceRef.current = map;

      return () => {
        map.remove();
      };
    });

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      const map = mapInstanceRef.current as { remove?: () => void } | null;
      map?.remove?.();
      mapInstanceRef.current = null;
    };
  }, [center.lat, center.lng, listings.length, locale, mapboxToken]);

  useEffect(() => {
    const map = mapInstanceRef.current as
      | {
          fitBounds: (bounds: [[number, number], [number, number]], options?: { padding?: number; duration?: number }) => void;
        }
      | null;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (!mapboxToken || !mapRef.current || !mapInstanceRef.current) {
      return;
    }

    void import("mapbox-gl").then(({ default: mapboxgl }) => {
      const bounds: Array<[number, number]> = [];

      for (const listing of listings) {
        if (!listing.location) {
          continue;
        }

        const marker = new mapboxgl.Marker({ color: "#8f4f32" })
          .setLngLat([listing.location.lng, listing.location.lat])
          .setPopup(new mapboxgl.Popup({ offset: 24 }).setText(listing.title[locale]))
          .addTo(mapInstanceRef.current as mapboxgl.Map);

        markersRef.current.push(marker);
        bounds.push([listing.location.lng, listing.location.lat]);
      }

      if (map && bounds.length > 1) {
        const [firstLng, firstLat] = bounds[0];
        let west = firstLng;
        let east = firstLng;
        let south = firstLat;
        let north = firstLat;

        for (const [lng, lat] of bounds.slice(1)) {
          west = Math.min(west, lng);
          east = Math.max(east, lng);
          south = Math.min(south, lat);
          north = Math.max(north, lat);
        }

        map.fitBounds(
          [
            [west, south],
            [east, north]
          ],
          { padding: 60, duration: 0 }
        );
      }
    });
  }, [listings, locale, mapboxToken]);

  function applyVisibleBounds() {
    const map = mapInstanceRef.current as
      | {
          getBounds: () => { getNorth: () => number; getSouth: () => number; getEast: () => number; getWest: () => number };
        }
      | null;

    if (!map) {
      return;
    }

    const bounds = map.getBounds();
    const params = new URLSearchParams(searchParams.toString());
    params.set("north", bounds.getNorth().toFixed(6));
    params.set("south", bounds.getSouth().toFixed(6));
    params.set("east", bounds.getEast().toFixed(6));
    params.set("west", bounds.getWest().toFixed(6));
    router.push(`${pathname}?${params.toString()}`);
    setMobileOpen(false);
    setMapMoved(false);
  }

  const mapBody = mapboxToken ? (
    <>
      <div ref={mapRef} className="h-[360px] rounded-[1.5rem]" />
      <button
        type="button"
        onClick={applyVisibleBounds}
        disabled={!mapMoved}
        className="mt-4 rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {labels.searchArea}
      </button>
    </>
  ) : (
    <div className="grid h-[360px] place-items-center rounded-[1.5rem] border border-dashed border-stone-400/60 bg-white/60 text-center text-stone-600">
      {labels.unavailable}
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen((open) => !open)}
        className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 lg:hidden"
      >
        {mobileOpen ? labels.close : labels.open}
      </button>
      <div className="hidden lg:block">
        <div className="sticky top-6 rounded-[2rem] border border-stone-200/80 bg-white/80 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.05)]">
          <div className="text-sm uppercase tracking-[0.24em] text-stone-500">{labels.title}</div>
          <div className="mt-6">{mapBody}</div>
        </div>
      </div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/30 p-4 lg:hidden">
          <div className="flex h-full flex-col rounded-[2rem] bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="text-sm uppercase tracking-[0.24em] text-stone-500">{labels.title}</div>
              <button type="button" onClick={() => setMobileOpen(false)} className="text-sm font-semibold text-stone-700">
                {labels.close}
              </button>
            </div>
            <div className="mt-4 flex-1">{mapBody}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
