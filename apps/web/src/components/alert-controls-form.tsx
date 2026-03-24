"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AlertControlsFormProps = {
  alert: {
    id: string;
    isPaused: boolean;
    snoozedUntil?: string | null;
    notifyByPush: boolean;
    notifyByEmail: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  };
};

export function AlertControlsForm({ alert }: AlertControlsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [notifyByPush, setNotifyByPush] = useState(alert.notifyByPush);
  const [notifyByEmail, setNotifyByEmail] = useState(alert.notifyByEmail);
  const [quietHoursStart, setQuietHoursStart] = useState(alert.quietHoursStart ?? "23:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState(alert.quietHoursEnd ?? "07:00");
  const [message, setMessage] = useState<string | null>(null);

  async function patchAlert(payload: Record<string, unknown>) {
    setLoading(true);
    setMessage(null);

    const response = await fetch(`/api/alerts/${alert.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    setLoading(false);

    if (!response.ok) {
      setMessage("Unable to update alert");
      return false;
    }

    setMessage("Saved");
    router.refresh();
    return true;
  }

  async function handleSavePreferences() {
    await patchAlert({
      notifyByPush,
      notifyByEmail,
      quietHoursStart,
      quietHoursEnd
    });
  }

  async function handlePauseToggle() {
    await patchAlert({
      isPaused: !alert.isPaused,
      ...(alert.isPaused ? { clearSnooze: true } : {})
    });
  }

  async function handleSnooze(hours: number) {
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    await patchAlert({
      isPaused: false,
      snoozedUntil: until
    });
  }

  async function handleClearSnooze() {
    await patchAlert({
      clearSnooze: true
    });
  }

  return (
    <div className="grid gap-3 rounded-[24px] bg-[var(--jinka-surface-muted)] p-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handlePauseToggle}
          disabled={loading}
          className="rounded-full border border-[var(--jinka-border)] bg-[var(--jinka-surface)] px-4 py-2 text-sm font-medium text-[var(--jinka-text)] disabled:opacity-60"
        >
          {loading ? "Saving..." : alert.isPaused ? "Resume alert" : "Pause alert"}
        </button>
        <button
          type="button"
          onClick={() => handleSnooze(24)}
          disabled={loading}
          className="rounded-full border border-[var(--jinka-border)] px-4 py-2 text-sm font-medium text-[var(--jinka-muted)] disabled:opacity-60"
        >
          Snooze 24h
        </button>
        <button
          type="button"
          onClick={() => handleSnooze(24 * 7)}
          disabled={loading}
          className="rounded-full border border-[var(--jinka-border)] px-4 py-2 text-sm font-medium text-[var(--jinka-muted)] disabled:opacity-60"
        >
          Snooze 7d
        </button>
        {alert.snoozedUntil ? (
          <button
            type="button"
            onClick={handleClearSnooze}
            disabled={loading}
            className="rounded-full border border-[var(--jinka-border)] px-4 py-2 text-sm font-medium text-[var(--jinka-muted)] disabled:opacity-60"
          >
            Clear snooze
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-3 rounded-[20px] bg-[var(--jinka-surface)] px-4 py-3 text-sm text-[var(--jinka-text)]">
          <input
            type="checkbox"
            checked={notifyByPush}
            onChange={(event) => setNotifyByPush(event.target.checked)}
          />
          <span>Browser push</span>
        </label>
        <label className="flex items-center gap-3 rounded-[20px] bg-[var(--jinka-surface)] px-4 py-3 text-sm text-[var(--jinka-text)]">
          <input
            type="checkbox"
            checked={notifyByEmail}
            onChange={(event) => setNotifyByEmail(event.target.checked)}
          />
          <span>Email</span>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm text-[var(--jinka-muted)]">
          <span>Quiet hours start</span>
          <input
            type="time"
            value={quietHoursStart}
            onChange={(event) => setQuietHoursStart(event.target.value)}
            className="rounded-[18px] border border-[var(--jinka-border)] bg-[var(--jinka-surface)] px-4 py-3 text-[var(--jinka-text)] outline-none"
          />
        </label>
        <label className="grid gap-2 text-sm text-[var(--jinka-muted)]">
          <span>Quiet hours end</span>
          <input
            type="time"
            value={quietHoursEnd}
            onChange={(event) => setQuietHoursEnd(event.target.value)}
            className="rounded-[18px] border border-[var(--jinka-border)] bg-[var(--jinka-surface)] px-4 py-3 text-[var(--jinka-text)] outline-none"
          />
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-[var(--jinka-muted)]">
          {message ?? "Adjust delivery channels and temporary pauses without recreating the alert."}
        </div>
        <button
          type="button"
          onClick={handleSavePreferences}
          disabled={loading}
          className="rounded-full bg-[var(--jinka-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Save controls
        </button>
      </div>
    </div>
  );
}
