"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SearchFilters } from "@jinka-eg/types";
import { AreaSearchField, type AreaOption } from "./area-search-field";

export function CreateAlertForm({
  locale,
  initialFilters,
  areas,
  labels
}: {
  locale: "en" | "ar";
  initialFilters?: SearchFilters;
  areas?: AreaOption[];
  labels: {
    allAreas: string;
    searchAreas: string;
    noAreasFound: string;
    clearSelection: string;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initialFilters?.query ? `${initialFilters.query} alert` : "Saved search");
  const [areaId, setAreaId] = useState(initialFilters?.areaIds?.[0] ?? "");
  const [purpose, setPurpose] = useState<"sale" | "rent">(initialFilters?.purpose ?? "sale");
  const [bedrooms, setBedrooms] = useState(initialFilters?.bedrooms?.[0] ? String(initialFilters.bedrooms[0]) : "");
  const [maxPrice, setMaxPrice] = useState(initialFilters?.maxPrice ? String(initialFilters.maxPrice) : "");
  const [notifyByPush, setNotifyByPush] = useState(true);
  const [notifyByEmail, setNotifyByEmail] = useState(true);
  const [quietHoursStart, setQuietHoursStart] = useState("23:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("07:00");
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
        notifyByPush,
        notifyByEmail,
        quietHoursStart,
        quietHoursEnd
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
        <AreaSearchField
          locale={locale}
          options={areas}
          value={areaId}
          onChange={(value) => setAreaId(typeof value === "string" ? value : value[0] ?? "")}
          allLabel={labels.allAreas}
          searchPlaceholder={labels.searchAreas}
          emptyMessage={labels.noAreasFound}
          clearLabel={labels.clearSelection}
        />
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
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-3 rounded-[22px] bg-[var(--jinka-surface-muted)] px-4 py-3 text-sm text-[var(--jinka-text)]">
          <input
            type="checkbox"
            checked={notifyByPush}
            onChange={(event) => setNotifyByPush(event.target.checked)}
          />
          <span>Enable browser push</span>
        </label>
        <label className="flex items-center gap-3 rounded-[22px] bg-[var(--jinka-surface-muted)] px-4 py-3 text-sm text-[var(--jinka-text)]">
          <input
            type="checkbox"
            checked={notifyByEmail}
            onChange={(event) => setNotifyByEmail(event.target.checked)}
          />
          <span>Enable email delivery</span>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm text-[var(--jinka-muted)]">
          <span>Quiet hours start</span>
          <input
            type="time"
            value={quietHoursStart}
            onChange={(event) => setQuietHoursStart(event.target.value)}
            className="border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-3 text-sm text-[var(--jinka-text)] outline-none transition focus:border-[var(--jinka-accent)]"
          />
        </label>
        <label className="grid gap-2 text-sm text-[var(--jinka-muted)]">
          <span>Quiet hours end</span>
          <input
            type="time"
            value={quietHoursEnd}
            onChange={(event) => setQuietHoursEnd(event.target.value)}
            className="border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-3 text-sm text-[var(--jinka-text)] outline-none transition focus:border-[var(--jinka-accent)]"
          />
        </label>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-[22px] bg-[var(--jinka-surface-muted)] px-4 py-3 text-sm text-[var(--jinka-muted)]">
        <span>Choose how this alert can reach you.</span>
        <span>
          {quietHoursStart} to {quietHoursEnd} quiet hours
        </span>
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
