import { MarketingHeader } from "../../../components/marketing-header";
import { getMessages, resolveLocale } from "../../../i18n/messages";

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);

  return (
    <div className="min-h-screen">
      <MarketingHeader locale={safeLocale} labels={t} />
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-5xl font-semibold tracking-tight text-stone-950">{t.termsTitle}</h1>
        <p className="mt-8 text-lg leading-8 text-stone-600">
          Aggregated detail pages stay non-indexed, contact handoff is source-directed, and high-risk or unauthorized surfaces can be disabled by operations.
        </p>
      </div>
    </div>
  );
}
