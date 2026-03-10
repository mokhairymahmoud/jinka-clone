"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateShortlistForm({ clusterId, locale }: { clusterId: string; locale: string }) {
  const router = useRouter();
  const [name, setName] = useState("My shortlist");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    const response = await fetch("/api/shortlists", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name,
        description,
        clusterIds: [clusterId]
      })
    });

    setLoading(false);

    if (!response.ok) {
      setStatus("Shortlist creation failed.");
      return;
    }

    const shortlist = (await response.json()) as { id: string };
    setStatus("Shortlist created.");
    router.push(`/${locale}/shortlists/${shortlist.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-stone-200 p-4">
      <div className="text-sm font-semibold text-stone-900">Create shortlist</div>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700"
      />
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={2}
        placeholder="Optional note"
        className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Creating..." : "Create and open"}
      </button>
      {status ? <div className="text-xs text-stone-500">{status}</div> : null}
    </form>
  );
}
