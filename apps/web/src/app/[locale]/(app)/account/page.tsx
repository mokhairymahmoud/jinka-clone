import { Badge, Card } from "@jinka-eg/ui";

import { AccountSettingsForm } from "../../../../components/account-settings-form";
import { PushSubscriptionManager } from "../../../../components/push-subscription-manager";
import { getMessages, resolveLocale } from "../../../../i18n/messages";
import { requireSessionUser } from "../../../../lib/session";

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);
  const user = await requireSessionUser(safeLocale);

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-[var(--jinka-border)] bg-[var(--jinka-surface)] p-6 shadow-[var(--jinka-shadow)]">
        <Badge tone="accent">{t.navAccount}</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--jinka-text)]">{t.accountTitle}</h1>
        <p className="mt-3 max-w-2xl text-[var(--jinka-muted)]">Manage your identity, delivery preferences, and browser-level push permissions.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="space-y-4 border-[var(--jinka-border)] p-6 shadow-[var(--jinka-shadow)]">
          <div className="text-lg font-semibold text-[var(--jinka-text)]">Identity</div>
          <div className="space-y-3 rounded-[24px] border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] p-4">
            <div className="text-sm text-[var(--jinka-muted)]">Email</div>
            <div className="font-medium text-[var(--jinka-text)]">{user.email}</div>
            <div className="text-sm text-[var(--jinka-muted)]">Role</div>
            <div className="font-medium uppercase tracking-[0.18em] text-[var(--jinka-text)]">{user.role}</div>
          </div>
        </Card>
        <Card className="border-[var(--jinka-border)] p-6 shadow-[var(--jinka-shadow)]">
          <AccountSettingsForm user={user} currentLocale={safeLocale} />
        </Card>
        <Card className="border-[var(--jinka-border)] p-6 shadow-[var(--jinka-shadow)]">
          <PushSubscriptionManager
            enableLabel={t.enableBrowserPush}
            disableLabel={t.disableBrowserPush}
            connectedLabel={t.pushConnected}
            disconnectedLabel={t.pushDisconnected}
            unsupportedLabel={t.pushNotSupported}
          />
        </Card>
      </div>
    </div>
  );
}
