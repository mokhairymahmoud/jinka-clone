"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateAlertForm() {
  const router = useRouter();
  const [name, setName] = useState("New Cairo search");
  const [areaId, setAreaId] = useState("new-cairo");
  const [purpose, setPurpose] = useState<"sale" | "rent">("sale");
  const [bedrooms, setBedrooms] = useState("3");
  const [maxPrice, setMaxPrice] = useState("5000000");
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
        locale: "en",
        filters: {
          purpose,
          areaIds: areaId ? [areaId] : [],
          bedrooms: bedrooms ? [Number(bedrooms)] : [],
          maxPrice: maxPrice ? Number(maxPrice) : undefined
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
    <form className="grid gap-3 rounded-[2rem] border border-stone-200 bg-stone-50 p-5" onSubmit={handleSubmit}>
      <div className="text-sm font-semibold text-stone-900">Create alert</div>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950"
        placeholder="Alert name"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={areaId}
          onChange={(event) => setAreaId(event.target.value)}
          className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950"
          placeholder="Area slug"
        />
        <select
          value={purpose}
          onChange={(event) => setPurpose(event.target.value as "sale" | "rent")}
          className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950"
        >
          <option value="sale">Sale</option>
          <option value="rent">Rent</option>
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={bedrooms}
          onChange={(event) => setBedrooms(event.target.value)}
          className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950"
          placeholder="Bedrooms"
        />
        <input
          value={maxPrice}
          onChange={(event) => setMaxPrice(event.target.value)}
          className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950"
          placeholder="Max price"
        />
      </div>
      {message ? <div className="text-sm text-stone-600">{message}</div> : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Saving..." : "Save alert"}
      </button>
    </form>
  );
}
