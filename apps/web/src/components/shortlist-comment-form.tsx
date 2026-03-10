"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ShortlistCommentForm({ shortlistId }: { shortlistId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    const response = await fetch(`/api/shortlists/${shortlistId}/comments`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ body })
    });

    setLoading(false);
    setStatus(response.ok ? "Comment added." : "Comment failed.");

    if (response.ok) {
      setBody("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-stone-200 p-4">
      <div className="text-sm font-semibold text-stone-900">Add note</div>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        placeholder="Leave a note for collaborators"
        className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700"
      />
      <button
        type="submit"
        disabled={loading || !body.trim()}
        className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Saving..." : "Add note"}
      </button>
      {status ? <div className="text-xs text-stone-500">{status}</div> : null}
    </form>
  );
}
