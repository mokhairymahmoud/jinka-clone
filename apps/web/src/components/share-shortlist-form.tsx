"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ShareShortlistForm({ shortlistId }: { shortlistId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    const response = await fetch(`/api/shortlists/${shortlistId}/share`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email,
        role: "editor"
      })
    });

    setLoading(false);
    setStatus(response.ok ? "Shared." : "Share failed.");

    if (response.ok) {
      setEmail("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-stone-200 p-4">
      <div className="text-sm font-semibold text-stone-900">Share shortlist</div>
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="partner@example.com"
        className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700"
      />
      <button
        type="submit"
        disabled={loading || !email.trim()}
        className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Sharing..." : "Share"}
      </button>
      {status ? <div className="text-xs text-stone-500">{status}</div> : null}
    </form>
  );
}
