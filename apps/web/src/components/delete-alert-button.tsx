"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteAlertButton({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (loading) {
      return;
    }

    const confirmed = window.confirm("Delete this alert and its announcements?");
    if (!confirmed) {
      return;
    }

    setLoading(true);

    const response = await fetch(`/api/alerts/${alertId}`, {
      method: "DELETE"
    });

    setLoading(false);

    if (!response.ok) {
      window.alert("Unable to delete alert");
      return;
    }

    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="rounded-full border border-[var(--jinka-border)] px-4 py-2 text-sm font-medium text-[var(--jinka-muted)] transition hover:border-[var(--jinka-text)] hover:text-[var(--jinka-text)] disabled:opacity-60"
    >
      {loading ? "Deleting..." : "Delete alert"}
    </button>
  );
}
