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

export default async function AlertsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getMessages(resolveLocale(locale));
  const alerts = (await fetchAlerts()) as Array<{
    id: string;
    name: string;
    filters: Record<string, unknown>;
    notifyByPush: boolean;
    notifyByEmail: boolean;
  }>;

  return (
    <div className="space-y-8">
      <div>
        <Badge tone="accent">{t.navAlerts}</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">{t.alertsTitle}</h1>
      </div>
      <CreateAlertForm />
      <div className="grid gap-4">
        {alerts.map((alert) => (
          <Card key={alert.id} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-stone-950">{alert.name}</div>
                <div className="mt-1 text-sm text-stone-600">{JSON.stringify(alert.filters)}</div>
              </div>
              <div className="text-sm text-stone-500">
                {alert.notifyByPush ? "push" : ""} {alert.notifyByEmail ? "email" : ""}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
