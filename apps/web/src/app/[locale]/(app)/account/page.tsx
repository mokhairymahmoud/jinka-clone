import { Badge, Card } from "@jinka-eg/ui";

import { getMessages, resolveLocale } from "../../../../i18n/messages";

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);

  return (
    <div className="space-y-8">
      <div>
        <Badge tone="accent">{t.navAccount}</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">{t.accountTitle}</h1>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="space-y-4 p-6">
          <div className="text-lg font-semibold text-stone-950">Language</div>
          <div className="rounded-2xl bg-stone-100 px-4 py-3 text-stone-700">{safeLocale.toUpperCase()}</div>
        </Card>
        <Card className="space-y-4 p-6">
          <div className="text-lg font-semibold text-stone-950">Notifications</div>
          <div className="rounded-2xl bg-stone-100 px-4 py-3 text-stone-700">Push + email enabled</div>
        </Card>
      </div>
    </div>
  );
}
