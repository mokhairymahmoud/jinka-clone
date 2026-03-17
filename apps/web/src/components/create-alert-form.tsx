"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SearchFilters } from "@jinka-eg/types";

type AreaOption = {
  id: string;
  slug: string;
  name: {
    en: string;
    ar: string;
  };
};

export function CreateAlertForm({
  locale,
  initialFilters,
  areas
}: {
  locale: "en" | "ar";
  initialFilters?: SearchFilters;
  areas?: AreaOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialFilters?.query ? `${initialFilters.query} alert` : "Saved search");
  const [areaId, setAreaId] = useState(initialFilters?.areaIds?.[0] ?? "");
  const [purpose, setPurpose] = useState<"sale" | "rent">(initialFilters?.purpose ?? "sale");
  const [bedrooms, setBedrooms] = useState(initialFilters?.bedrooms?.[0] ? String(initialFilters.bedrooms[0]) : "");
  const [maxPrice, setMaxPrice] = useState(initialFilters?.maxPrice ? String(initialFilters.maxPrice) : "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/alerts", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name,
        locale,
        filters: {
          query: initialFilters?.query,
          sort: initialFilters?.sort,
          purpose,
          marketSegment: initialFilters?.marketSegment,
          propertyTypes: initialFilters?.propertyTypes,
          areaIds: areaId ? [areaId] : [],
          bedrooms: bedrooms ? [Number(bedrooms)] : [],
          bathrooms: initialFilters?.bathrooms,
          minPrice: initialFilters?.minPrice,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          minAreaSqm: initialFilters?.minAreaSqm,
          maxAreaSqm: initialFilters?.maxAreaSqm,
          bbox: initialFilters?.bbox
        },
        notifyByPush: true,
        notifyByEmail: true,
        quietHoursStart: "23:00",
        quietHoursEnd: "07:00"
      })
    });

    setLoading(false);

    if (!response.ok) {
      setMessage("Unable to create alert");
      return;
    }

    setMessage("Alert created");
    router.refresh();
  }

  return (
    <form className="grid gap-4 rounded-[28px] border border-[var(--jinka-border)] bg-[var(--jinka-surface)] p-5 shadow-[var(--jinka-shadow)]" onSubmit={handleSubmit}>
      <div>
        <div className="text-lg font-semibold text-[var(--jinka-text)]">Create an alert</div>
        <div className="mt-1 text-sm text-[var(--jinka-muted)]">Define the homes you want, then let the app announce only matching listings.</div>
      </div>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-3 text-sm text-[var(--jinka-text)] outline-none transition focus:border-[var(--jinka-accent)]"
        placeholder="Alert name"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          value={areaId}
          onChange={(event) => setAreaId(event.target.value)}
          className="border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-3 text-sm text-[var(--jinka-text)] outline-none transition focus:border-[var(--jinka-accent)]"
        >
          <option value="">All areas</option>
          {areas?.map((area) => (
            <option key={area.id} value={area.slug}>
              {area.name[locale]}
            </option>
          ))}
        </select>
        <select
          value={purpose}
          onChange={(event) => setPurpose(event.target.value as "sale" | "rent")}
          className="border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-3 text-sm text-[var(--jinka-text)] outline-none transition focus:border-[var(--jinka-accent)]"
        >
          <option value="sale">Sale</option>
          <option value="rent">Rent</option>
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={bedrooms}
          onChange={(event) => setBedrooms(event.target.value)}
          className="border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-3 text-sm text-[var(--jinka-text)] outline-none transition focus:border-[var(--jinka-accent)]"
          placeholder="Bedrooms"
        />
        <input
          value={maxPrice}
          onChange={(event) => setMaxPrice(event.target.value)}
          className="border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-3 text-sm text-[var(--jinka-text)] outline-none transition focus:border-[var(--jinka-accent)]"
          placeholder="Max price"
        />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-[22px] bg-[var(--jinka-surface-muted)] px-4 py-3 text-sm text-[var(--jinka-muted)]">
        <span>Push and email are enabled by default for new alerts.</span>
        <span>23:00 to 07:00 quiet hours</span>
      </div>
      {message ? <div className="text-sm text-[var(--jinka-muted)]">{message}</div> : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-[var(--jinka-accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Saving..." : "Save alert"}
      </button>
    </form>
  );
}
