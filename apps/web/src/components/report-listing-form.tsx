"use client";

import { useState } from "react";

export function ReportListingForm({ clusterId }: { clusterId: string }) {
  const [reason, setReason] = useState("wrong_info");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    const response = await fetch("/api/reports", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        clusterId,
        reason,
        details
      })
    });

    setLoading(false);
    setStatus(response.ok ? "Report submitted." : "Report submission failed.");

    if (response.ok) {
      setDetails("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-stone-200 p-4">
      <div className="text-sm font-semibold text-stone-900">Report this listing</div>
      <select
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700"
      >
        <option value="wrong_info">Wrong info</option>
        <option value="duplicate">Duplicate</option>
        <option value="fake">Fake</option>
      </select>
      <textarea
        value={details}
        onChange={(event) => setDetails(event.target.value)}
        rows={3}
        placeholder="What looks wrong?"
        className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Submitting..." : "Submit report"}
      </button>
      {status ? <div className="text-xs text-stone-500">{status}</div> : null}
    </form>
  );
}
