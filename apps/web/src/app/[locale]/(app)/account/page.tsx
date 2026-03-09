import { Badge, Card } from "@jinka-eg/ui";

import { AccountSettingsForm } from "../../../../components/account-settings-form";
import { getMessages, resolveLocale } from "../../../../i18n/messages";
import { requireSessionUser } from "../../../../lib/session";

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);
  const user = await requireSessionUser(safeLocale);

  return (
    <div className="space-y-8">
      <div>
        <Badge tone="accent">{t.navAccount}</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">{t.accountTitle}</h1>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="space-y-4 p-6">
          <div className="text-lg font-semibold text-stone-950">Identity</div>
          <div className="space-y-3 rounded-3xl border border-stone-200 bg-stone-50 p-4">
            <div className="text-sm text-stone-500">Email</div>
            <div className="font-medium text-stone-900">{user.email}</div>
            <div className="text-sm text-stone-500">Role</div>
            <div className="font-medium uppercase tracking-[0.18em] text-stone-900">{user.role}</div>
          </div>
        </Card>
        <Card className="p-6">
          <AccountSettingsForm user={user} currentLocale={safeLocale} />
        </Card>
      </div>
    </div>
  );
}
