import { mockAlerts } from "@jinka-eg/fixtures";
import { Badge, Card } from "@jinka-eg/ui";

import { getMessages, resolveLocale } from "../../../../i18n/messages";

export default async function AlertsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getMessages(resolveLocale(locale));

  return (
    <div className="space-y-8">
      <div>
        <Badge tone="accent">{t.navAlerts}</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">{t.alertsTitle}</h1>
      </div>
      <div className="grid gap-4">
        {mockAlerts.map((alert) => (
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
