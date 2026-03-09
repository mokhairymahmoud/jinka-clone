import { Badge, Card } from "@jinka-eg/ui";

import { MarketingHeader } from "../../../components/marketing-header";
import { getMessages, resolveLocale } from "../../../i18n/messages";

export default async function TrustPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);

  return (
    <div className="min-h-screen">
      <MarketingHeader locale={safeLocale} labels={t} />
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-5xl font-semibold tracking-tight text-stone-950">{t.trustTitle}</h1>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <Card className="p-6">
            <Badge tone="accent">Rule engine</Badge>
            <p className="mt-4 text-stone-600">Detect abnormal prices, conflicting fields, image reuse, and risky repost patterns.</p>
          </Card>
          <Card className="p-6">
            <Badge tone="danger">Review queue</Badge>
            <p className="mt-4 text-stone-600">Borderline cases are sent to operators instead of being silently published as safe.</p>
          </Card>
          <Card className="p-6">
            <Badge tone="success">Source attribution</Badge>
            <p className="mt-4 text-stone-600">Every listing keeps its source links and variant history visible for auditability.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
