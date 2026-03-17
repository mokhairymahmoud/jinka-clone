import { redirect } from "next/navigation";

import { Badge, Card } from "@jinka-eg/ui";

import { MarketingHeader } from "../../../components/marketing-header";
import { SignInForm } from "../../../components/sign-in-form";
import { getMessages, resolveLocale } from "../../../i18n/messages";
import { getSessionUser } from "../../../lib/session";

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);
  const user = await getSessionUser();

  if (user) {
    redirect(`/${safeLocale}/alerts`);
  }

  return (
    <div className="min-h-screen">
      <MarketingHeader locale={safeLocale} labels={t} />
      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 lg:grid-cols-[1.05fr_420px]">
        <div className="space-y-6 self-center">
          <Badge tone="accent">Alert-first experience</Badge>
          <h1 className="text-5xl font-bold tracking-tight text-[var(--jinka-text)] md:text-6xl">
            Activate alerts, then only see the homes that match.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-[var(--jinka-muted)]">
            The customer side is now centered on Jinka’s real workflow: create alerts, receive matching announcements, and open only the listings that matter.
          </p>
          <div className="grid max-w-xl gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-[var(--jinka-border)] bg-[var(--jinka-surface)] p-4 shadow-[var(--jinka-shadow)]">
              <div className="text-sm font-semibold text-[var(--jinka-text)]">Sign in options</div>
              <div className="mt-2 text-sm text-[var(--jinka-muted)]">Email OTP and Google OAuth are both available.</div>
            </div>
            <div className="rounded-[24px] border border-[var(--jinka-border)] bg-[var(--jinka-surface)] p-4 shadow-[var(--jinka-shadow)]">
              <div className="text-sm font-semibold text-[var(--jinka-text)]">Local demo</div>
              <div className="mt-2 text-sm text-[var(--jinka-muted)]">OTP preview is exposed in development for fast testing.</div>
            </div>
          </div>
        </div>
        <Card className="border-[var(--jinka-border)] p-6 shadow-[var(--jinka-shadow)]">
          <SignInForm locale={safeLocale} />
        </Card>
      </div>
    </div>
  );
}
