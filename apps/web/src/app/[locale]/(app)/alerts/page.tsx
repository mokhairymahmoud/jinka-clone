import { Badge, Card } from "@jinka-eg/ui";

import { CreateAlertForm } from "../../../../components/create-alert-form";
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

export default async function AlertsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);
  const [alerts, areas] = await Promise.all([fetchAlerts(), fetchAreas()]);
  const typedAlerts = alerts as Array<{
    id: string;
    name: string;
    filters: Record<string, unknown>;
    notifyByPush: boolean;
    notifyByEmail: boolean;
  }>;

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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-lg font-semibold text-[var(--jinka-text)]">{alert.name}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(alert.filters).map(([key, value]) => (
                    <span key={key} className="inline-flex rounded-full bg-[var(--jinka-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--jinka-muted)]">
                      {key}: {Array.isArray(value) ? value.join(", ") : String(value)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                {alert.notifyByPush ? <span className="rounded-full bg-[var(--jinka-accent-soft)] px-3 py-1 font-medium text-[var(--jinka-accent)]">push</span> : null}
                {alert.notifyByEmail ? <span className="rounded-full bg-[var(--jinka-surface-muted)] px-3 py-1 font-medium text-[var(--jinka-text)]">email</span> : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
