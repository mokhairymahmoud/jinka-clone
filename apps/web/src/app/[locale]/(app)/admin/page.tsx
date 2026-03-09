import { Badge, Card } from "@jinka-eg/ui";

import { getMessages, resolveLocale } from "../../../../i18n/messages";

const connectors = [
  { source: "nawy", status: "healthy", coverage: "97%" },
  { source: "property_finder", status: "healthy", coverage: "95%" },
  { source: "aqarmap", status: "degraded", coverage: "73%" },
  { source: "facebook", status: "limited", coverage: "68%" }
];

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getMessages(resolveLocale(locale));

  return (
    <div className="space-y-8">
      <div>
        <Badge tone="accent">{t.admin}</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">{t.adminTitle}</h1>
      </div>
      <div className="grid gap-4">
        {connectors.map((connector) => (
          <Card key={connector.source} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-stone-950">{connector.source}</div>
                <div className="mt-1 text-sm text-stone-600">Parser coverage {connector.coverage}</div>
              </div>
              <Badge tone={connector.status === "healthy" ? "success" : "danger"}>{connector.status}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
