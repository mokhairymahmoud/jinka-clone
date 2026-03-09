"use client";

import { useState } from "react";

export function FavoriteButton({
  clusterId,
  initialSaved
}: {
  clusterId: string;
  initialSaved?: boolean;
}) {
  const [saved, setSaved] = useState(Boolean(initialSaved));
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (saved || loading) {
      return;
    }

    setLoading(true);

    const response = await fetch("/api/favorites", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ clusterId })
    });

    setLoading(false);

    if (response.ok) {
      setSaved(true);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={saved || loading}
      className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {saved ? "Saved" : loading ? "Saving..." : "Save favorite"}
    </button>
  );
}
