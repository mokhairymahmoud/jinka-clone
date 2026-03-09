import Link from "next/link";
import { Badge, Card } from "@jinka-eg/ui";

import { getMessages, resolveLocale } from "../../../../i18n/messages";
import { apiFetch } from "../../../../lib/api";
import { getAccessTokenFromCookies } from "../../../../lib/server-api";

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

export default async function InboxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);
  const inboxItems = (await fetchNotifications()) as Array<{
    id: string;
    title: string;
    body: string;
    createdAt: string;
    clusterId?: string;
  }>;

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
                {item.clusterId ? (
                  <Link href={`/${safeLocale}/listing/${item.clusterId}`} className="mt-3 inline-flex text-sm font-semibold text-clay">
                    Open listing
                  </Link>
                ) : null}
              </div>
              <div className="text-sm text-stone-500">{new Date(item.createdAt).toLocaleString()}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
