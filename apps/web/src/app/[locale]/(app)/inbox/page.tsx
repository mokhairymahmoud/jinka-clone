import { Badge, Card } from "@jinka-eg/ui";

import { getMessages, resolveLocale } from "../../../../i18n/messages";

const inboxItems = [
  {
    id: "notif-001",
    title: "New match in New Cairo",
    body: "A fresh 3BR resale listing matched your saved alert.",
    timestamp: "2 minutes ago"
  },
  {
    id: "notif-002",
    title: "Price drop detected",
    body: "A Mivida unit dropped by EGP 150,000 across one source variant.",
    timestamp: "27 minutes ago"
  }
];

export default async function InboxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getMessages(resolveLocale(locale));

  return (
    <div className="space-y-8">
      <div>
        <Badge tone="accent">{t.navInbox}</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">Notification inbox</h1>
      </div>
      <div className="grid gap-4">
        {inboxItems.map((item) => (
          <Card key={item.id} className="p-5">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-lg font-semibold text-stone-950">{item.title}</div>
                <div className="mt-2 text-stone-600">{item.body}</div>
              </div>
              <div className="text-sm text-stone-500">{item.timestamp}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
