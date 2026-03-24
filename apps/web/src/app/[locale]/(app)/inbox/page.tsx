import Link from "next/link";
import { Badge, Card } from "@jinka-eg/ui";

import { getMessages, resolveLocale } from "../../../../i18n/messages";
import { apiFetch } from "../../../../lib/api";
import { getAccessTokenFromCookies } from "../../../../lib/server-api";

async function fetchNotifications(alertId?: string) {
  const accessToken = await getAccessTokenFromCookies();

  if (!accessToken) {
    return [];
  }

  const query = alertId ? `?alertId=${encodeURIComponent(alertId)}` : "";
  const response = await apiFetch(`/v1/notifications${query}`, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
}

async function fetchAlerts() {
  const accessToken = await getAccessTokenFromCookies();

  if (!accessToken) {
    return [];
  }

  const response = await apiFetch("/v1/alerts", {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
}

export default async function InboxPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ alertId?: string }>;
}) {
  const { locale } = await params;
  const { alertId } = await searchParams;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);
  const [inboxItems, alerts] = await Promise.all([fetchNotifications(alertId), fetchAlerts()]);
  const typedAlerts = alerts as Array<{
    id: string;
    name: string;
  }>;
  const selectedAlert = typedAlerts.find((alert) => alert.id === alertId);
  const typedInboxItems = inboxItems as Array<{
    id: string;
    title: string;
    body: string;
    createdAt: string;
    alertId?: string;
    alertName?: string;
    clusterId?: string;
  }>;

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-[var(--jinka-border)] bg-[var(--jinka-surface)] p-6 shadow-[var(--jinka-shadow)]">
        <Badge tone="accent">{t.navInbox}</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--jinka-text)]">Announcements</h1>
        <p className="mt-3 max-w-2xl text-[var(--jinka-muted)]">
          {selectedAlert
            ? `Showing announcements for ${selectedAlert.name}.`
            : "This feed should contain only listings that matched one of your active alerts."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/${safeLocale}/inbox`}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            !selectedAlert
              ? "bg-[var(--jinka-accent)] text-white"
              : "border border-[var(--jinka-border)] text-[var(--jinka-muted)] hover:border-[var(--jinka-text)] hover:text-[var(--jinka-text)]"
          }`}
        >
          All alerts
        </Link>
        {typedAlerts.map((alert) => (
          <Link
            key={alert.id}
            href={`/${safeLocale}/inbox?alertId=${encodeURIComponent(alert.id)}`}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              selectedAlert?.id === alert.id
                ? "bg-[var(--jinka-accent)] text-white"
                : "border border-[var(--jinka-border)] text-[var(--jinka-muted)] hover:border-[var(--jinka-text)] hover:text-[var(--jinka-text)]"
            }`}
          >
            {alert.name}
          </Link>
        ))}
      </div>
      <div className="grid gap-4">
        {typedInboxItems.map((item) => (
          <Card key={item.id} className="border-[var(--jinka-border)] p-5 shadow-[var(--jinka-shadow)]">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-lg font-semibold text-[var(--jinka-text)]">{item.title}</div>
                {item.alertId && !selectedAlert ? (
                  <Link
                    href={`/${safeLocale}/inbox?alertId=${encodeURIComponent(item.alertId)}`}
                    className="mt-2 inline-flex text-sm font-medium text-[var(--jinka-accent)]"
                  >
                    {item.alertName ?? "View this alert"}
                  </Link>
                ) : null}
                <div className="mt-2 text-[var(--jinka-muted)]">{item.body}</div>
                {item.clusterId ? (
                  <Link
                    href={`/${safeLocale}/listing/${item.clusterId}`}
                    className="mt-4 inline-flex rounded-full bg-[var(--jinka-accent)] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Open listing
                  </Link>
                ) : null}
              </div>
              <div className="rounded-full bg-[var(--jinka-surface-muted)] px-3 py-1 text-sm text-[var(--jinka-muted)]">
                {new Date(item.createdAt).toLocaleString()}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
