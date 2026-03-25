"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AuthSessionRecord } from "@jinka-eg/types";

export function SessionManagementPanel({
  sessions,
  locale
}: {
  sessions: AuthSessionRecord[];
  locale: string;
}) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRevokeSession(sessionId: string) {
    setLoadingAction(sessionId);
    setMessage(null);

    const response = await fetch(`/api/auth/sessions/${sessionId}/revoke`, {
      method: "POST"
    });

    setLoadingAction(null);

    if (!response.ok) {
      setMessage("Unable to revoke session");
      return;
    }

    setMessage("Session revoked");
    router.refresh();
  }

  async function handleRevokeOthers() {
    setLoadingAction("revoke-others");
    setMessage(null);

    const response = await fetch("/api/auth/sessions/revoke-others", {
      method: "POST"
    });

    setLoadingAction(null);

    if (!response.ok) {
      setMessage("Unable to revoke other sessions");
      return;
    }

    setMessage("Other sessions revoked");
    router.refresh();
  }

  async function handleLogoutCurrent() {
    setLoadingAction("logout-current");
    setMessage(null);

    await fetch("/api/auth/logout", {
      method: "POST"
    });

    router.push(`/${locale}/sign-in`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-[var(--jinka-text)]">Sessions and devices</div>
          <p className="mt-1 text-sm text-[var(--jinka-muted)]">Review active sessions, identify the current device, and revoke anything you do not recognize.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRevokeOthers}
            disabled={loadingAction !== null}
            className="rounded-full border border-[var(--jinka-border)] px-4 py-2 text-sm font-medium text-[var(--jinka-text)] disabled:opacity-60"
          >
            Revoke other sessions
          </button>
          <button
            type="button"
            onClick={handleLogoutCurrent}
            disabled={loadingAction !== null}
            className="rounded-full bg-[var(--jinka-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Sign out this device
          </button>
        </div>
      </div>
      <div className="grid gap-3">
        {sessions.map((session) => (
          <div key={session.id} className="rounded-[24px] border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-[var(--jinka-text)]">
                    {session.deviceLabel} · {session.browserLabel}
                  </div>
                  {session.current ? (
                    <span className="inline-flex rounded-full bg-[var(--jinka-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--jinka-accent)]">
                      current
                    </span>
                  ) : null}
                </div>
                <div className="text-sm text-[var(--jinka-muted)]">
                  {session.ipAddress ? `IP ${session.ipAddress}` : "IP unavailable"} · last active {new Date(session.lastSeenAt).toLocaleString()}
                </div>
                <div className="text-xs text-[var(--jinka-muted)]">
                  Signed in {new Date(session.createdAt).toLocaleString()} · expires {new Date(session.expiresAt).toLocaleString()}
                </div>
              </div>
              {!session.current ? (
                <button
                  type="button"
                  onClick={() => handleRevokeSession(session.id)}
                  disabled={loadingAction !== null}
                  className="rounded-full border border-[var(--jinka-border)] bg-[var(--jinka-surface)] px-4 py-2 text-sm font-medium text-[var(--jinka-text)] disabled:opacity-60"
                >
                  {loadingAction === session.id ? "Revoking..." : "Revoke"}
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {sessions.length === 0 ? (
          <div className="rounded-[24px] border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-3 text-sm text-[var(--jinka-muted)]">
            No active sessions found.
          </div>
        ) : null}
      </div>
      {message ? <div className="text-sm text-[var(--jinka-muted)]">{message}</div> : null}
    </div>
  );
}
