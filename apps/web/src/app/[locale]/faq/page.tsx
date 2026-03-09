import { MarketingHeader } from "../../../components/marketing-header";
import { getMessages, resolveLocale } from "../../../i18n/messages";

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);

  return (
    <div className="min-h-screen">
      <MarketingHeader locale={safeLocale} labels={t} />
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-5xl font-semibold tracking-tight text-stone-950">{t.faqTitle}</h1>
        <div className="mt-10 space-y-8">
          <div>
            <h2 className="text-xl font-semibold">Does the app host the listings?</h2>
            <p className="mt-2 text-stone-600">No. The app aggregates, deduplicates, scores trust, and then deep-links to the original source.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Why are units and projects separate?</h2>
            <p className="mt-2 text-stone-600">Off-plan projects behave differently from live resale or rental units and need separate ranking and filters.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
