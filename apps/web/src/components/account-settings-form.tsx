"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SessionUser } from "../lib/session";

export function AccountSettingsForm({
  user,
  currentLocale
}: {
  user: SessionUser;
  currentLocale: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name ?? "");
  const [locale, setLocale] = useState(user.locale);
  const [emailEnabled, setEmailEnabled] = useState(user.notificationPrefs.emailEnabled ?? true);
  const [pushEnabled, setPushEnabled] = useState(user.notificationPrefs.pushEnabled ?? true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name,
        locale,
        notificationPrefs: {
          emailEnabled,
          pushEnabled
        }
      })
    });

    setSaving(false);

    if (!response.ok) {
      setMessage("Unable to save settings");
      return;
    }

    const updatedUser = (await response.json()) as SessionUser;
    setMessage("Settings saved");

    if (updatedUser.locale !== currentLocale) {
      router.push(`/${updatedUser.locale}/account`);
    }

    router.refresh();
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div>
        <div className="text-lg font-semibold text-[var(--jinka-text)]">Preferences</div>
        <p className="mt-1 text-sm text-[var(--jinka-muted)]">Keep delivery settings aligned with how customers actually use Jinka.</p>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--jinka-text)]" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-3 text-[var(--jinka-text)] outline-none transition focus:border-[var(--jinka-accent)]"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--jinka-text)]" htmlFor="locale">
          Interface language
        </label>
        <select
          id="locale"
          value={locale}
          onChange={(event) => setLocale(event.target.value)}
          className="w-full border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-3 text-[var(--jinka-text)] outline-none transition focus:border-[var(--jinka-accent)]"
        >
          <option value="en">English</option>
          <option value="ar">Arabic</option>
        </select>
      </div>

      <div className="space-y-3 rounded-[24px] border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] p-4">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-[var(--jinka-text)]">Email notifications</span>
          <input type="checkbox" checked={emailEnabled} onChange={(event) => setEmailEnabled(event.target.checked)} />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-[var(--jinka-text)]">Push notifications</span>
          <input type="checkbox" checked={pushEnabled} onChange={(event) => setPushEnabled(event.target.checked)} />
        </label>
      </div>

      {message ? <p className="text-sm text-[var(--jinka-muted)]">{message}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="rounded-full bg-[var(--jinka-accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
