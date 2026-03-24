import Link from "next/link";
import { Badge, Card } from "@jinka-eg/ui";

import type { AlertDefinition, NotificationItem } from "@jinka-eg/types";
import { AlertControlsForm } from "../../../../components/alert-controls-form";
import { CreateAlertForm } from "../../../../components/create-alert-form";
import { DeleteAlertButton } from "../../../../components/delete-alert-button";
import { getMessages, resolveLocale } from "../../../../i18n/messages";
import { apiFetch } from "../../../../lib/api";
import { getAccessTokenFromCookies } from "../../../../lib/server-api";

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

async function fetchAreas() {
  const response = await apiFetch("/v1/areas");

  if (!response.ok) {
    return [];
  }

  return response.json();
}

async function fetchNotifications() {
  const accessToken = await getAccessTokenFromCookies();

  if (!accessToken) {
    return [];
  }

  const response = await apiFetch("/v1/notifications", {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatPrice(value: number | null | undefined) {
  if (typeof value !== "number") {
    return null;
  }

  return new Intl.NumberFormat("en-US").format(value);
}

export default async function AlertsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);
  const [alerts, areas, notifications] = await Promise.all([fetchAlerts(), fetchAreas(), fetchNotifications()]);
  const typedAlerts = alerts as AlertDefinition[];
  const typedNotifications = notifications as NotificationItem[];
  const activityByAlert = typedNotifications.reduce<Record<string, NotificationItem[]>>((result, notification) => {
    if (!notification.alertId) {
      return result;
    }

    const existing = result[notification.alertId] ?? [];
    existing.push(notification);
    result[notification.alertId] = existing;
    return result;
  }, {});

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-[var(--jinka-border)] bg-[var(--jinka-surface)] p-6 shadow-[var(--jinka-shadow)]">
        <Badge tone="accent">{t.navAlerts}</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--jinka-text)]">{t.alertsTitle}</h1>
        <p className="mt-3 max-w-2xl text-[var(--jinka-muted)]">
          Create simple, high-signal alerts and let the customer experience revolve around the announcements they trigger.
        </p>
      </div>
      <CreateAlertForm
        locale={safeLocale}
        areas={areas as Parameters<typeof CreateAlertForm>[0]["areas"]}
        labels={{
          allAreas: t.allAreas,
          searchAreas: t.searchAreas,
          noAreasFound: t.noAreasFound,
          clearSelection: t.clearSelection
        }}
      />
      <div className="grid gap-4">
        {typedAlerts.map((alert) => (
          <Card key={alert.id} className="border-[var(--jinka-border)] p-5 shadow-[var(--jinka-shadow)]">
            <div className="grid gap-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <div>
                    <div className="text-lg font-semibold text-[var(--jinka-text)]">{alert.name}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {alert.isPaused ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                          paused
                        </span>
                      ) : null}
                      {alert.snoozedUntil ? (
                        <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                          snoozed until {formatDateTime(alert.snoozedUntil)}
                        </span>
                      ) : null}
                      {alert.lastMatchedAt ? (
                        <span className="inline-flex rounded-full bg-[var(--jinka-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--jinka-muted)]">
                          last match {formatDateTime(alert.lastMatchedAt)}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-[var(--jinka-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--jinka-muted)]">
                          no matches yet
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(alert.filters).map(([key, value]) => (
                      <span key={key} className="inline-flex rounded-full bg-[var(--jinka-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--jinka-muted)]">
                        {key}: {Array.isArray(value) ? value.join(", ") : String(value)}
                      </span>
                    ))}
                  </div>
                  <div className="text-sm text-[var(--jinka-muted)]">
                    Delivery cadence: {alert.deliveryCadence}
                  </div>
                  <div className="text-sm text-[var(--jinka-muted)]">
                    Price-drop threshold:{" "}
                    {alert.minPriceDropPercent || alert.minPriceDropAmount
                      ? [
                          alert.minPriceDropPercent ? `${alert.minPriceDropPercent}%` : null,
                          alert.minPriceDropAmount ? `EGP ${formatPrice(alert.minPriceDropAmount)}` : null
                        ]
                          .filter(Boolean)
                          .join(" and ")
                      : "any drop"}
                  </div>
                  <div className="text-sm text-[var(--jinka-muted)]">
                    Quiet hours: {alert.quietHoursStart ?? "none"} to {alert.quietHoursEnd ?? "none"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  {alert.notifyByPush ? <span className="rounded-full bg-[var(--jinka-accent-soft)] px-3 py-1 font-medium text-[var(--jinka-accent)]">push</span> : null}
                  {alert.notifyByEmail ? <span className="rounded-full bg-[var(--jinka-surface-muted)] px-3 py-1 font-medium text-[var(--jinka-text)]">email</span> : null}
                  <DeleteAlertButton alertId={alert.id} />
                </div>
              </div>
              <AlertControlsForm alert={alert} />
              <div className="grid gap-3 rounded-[24px] border border-[var(--jinka-border)] bg-[var(--jinka-surface)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--jinka-text)]">Recent activity</div>
                    <div className="text-sm text-[var(--jinka-muted)]">Latest inbox events and delivery states for this alert.</div>
                  </div>
                  <Link
                    href={`/${safeLocale}/inbox?alertId=${encodeURIComponent(alert.id)}`}
                    className="text-sm font-medium text-[var(--jinka-accent)]"
                  >
                    Open full history
                  </Link>
                </div>
                {(activityByAlert[alert.id] ?? []).slice(0, 3).map((item) => (
                  <div key={item.id} className="rounded-[20px] bg-[var(--jinka-surface-muted)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-[var(--jinka-text)]">{item.title}</div>
                        <div className="text-sm text-[var(--jinka-muted)]">{item.body}</div>
                        {item.metadata?.eventType === "price_drop" ? (
                          <div className="text-xs font-medium text-[var(--jinka-accent)]">
                            Dropped by {item.metadata.percentageDrop ?? 0}% ({formatPrice(item.metadata.amountDrop)} EGP) from{" "}
                            {formatPrice(item.metadata.previousBestPrice)} EGP
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          {(item.deliveries ?? []).map((delivery) => (
                            <span
                              key={`${item.id}:${delivery.channel}`}
                              className="inline-flex rounded-full bg-[var(--jinka-surface)] px-3 py-1 text-xs font-medium text-[var(--jinka-muted)]"
                            >
                              {delivery.channel}: {delivery.status}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-xs text-[var(--jinka-muted)]">{formatDateTime(item.createdAt)}</div>
                    </div>
                  </div>
                ))}
                {(activityByAlert[alert.id] ?? []).length === 0 ? (
                  <div className="rounded-[20px] bg-[var(--jinka-surface-muted)] px-4 py-3 text-sm text-[var(--jinka-muted)]">
                    No activity yet for this alert.
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
