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
    <div className="space-y-6">
      <div className="rounded-[32px] border border-[var(--jinka-border)] bg-[var(--jinka-surface)] p-6 shadow-[var(--jinka-shadow)]">
        <Badge tone="accent">{t.navInbox}</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--jinka-text)]">Announcements</h1>
        <p className="mt-3 max-w-2xl text-[var(--jinka-muted)]">
          This feed should contain only listings that matched one of your active alerts.
        </p>
      </div>
      <div className="grid gap-4">
        {inboxItems.map((item) => (
          <Card key={item.id} className="border-[var(--jinka-border)] p-5 shadow-[var(--jinka-shadow)]">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-lg font-semibold text-[var(--jinka-text)]">{item.title}</div>
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
