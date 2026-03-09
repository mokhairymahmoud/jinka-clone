import { MarketingHeader } from "../../../components/marketing-header";
import { getMessages, resolveLocale } from "../../../i18n/messages";

export default async function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);

  return (
    <div className="min-h-screen">
      <MarketingHeader locale={safeLocale} labels={t} />
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-5xl font-semibold tracking-tight text-stone-950">{t.howTitle}</h1>
        <div className="mt-8 space-y-6 text-lg leading-8 text-stone-600">
          <p>1. Crawl source pages and APIs with source-specific connectors.</p>
          <p>2. Normalize raw snapshots into source variants, then cluster duplicates into canonical listings.</p>
          <p>3. Score listings for risk, publish search updates, and trigger alerts for matching users.</p>
        </div>
      </div>
    </div>
  );
}
