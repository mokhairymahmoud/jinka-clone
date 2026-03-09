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
    redirect(`/${safeLocale}/search/units`);
  }

  return (
    <div className="min-h-screen">
      <MarketingHeader locale={safeLocale} labels={t} />
      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Badge tone="accent">Phase 1 auth is live</Badge>
          <h1 className="font-display text-5xl font-bold tracking-tight text-stone-950">
            Sign in to access the protected app shell.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-stone-600">
            Email OTP is backed by the API and database. In local development, the OTP preview is returned for convenience.
          </p>
        </div>
        <Card className="p-6">
          <SignInForm locale={safeLocale} />
        </Card>
      </div>
    </div>
  );
}
