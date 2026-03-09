import { mockListings } from "@jinka-eg/fixtures";
import { Badge, Card } from "@jinka-eg/ui";

import { ListingCard } from "../../../../../components/listing-card";
import { getMessages, resolveLocale } from "../../../../../i18n/messages";

export default async function UnitSearchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Badge tone="accent">{t.units}</Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">Canonical unit search</h1>
          <p className="mt-3 max-w-2xl text-stone-600">
            Dense feed with freshness, variant count, and fraud label surfaced before detail view.
          </p>
        </div>
        <Card className="grid min-w-[300px] gap-3 p-4">
          <div className="text-sm font-medium text-stone-500">{t.filters}</div>
          <div className="grid grid-cols-2 gap-3 text-sm text-stone-700">
            <div className="rounded-2xl bg-stone-100 px-4 py-3">New Cairo</div>
            <div className="rounded-2xl bg-stone-100 px-4 py-3">3 beds</div>
            <div className="rounded-2xl bg-stone-100 px-4 py-3">EGP &lt; 5M</div>
            <div className="rounded-2xl bg-stone-100 px-4 py-3">{t.listMap}</div>
          </div>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-6">
          {mockListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} locale={safeLocale} />
          ))}
        </div>
        <Card className="sticky top-6 min-h-[480px] p-6">
          <div className="h-full rounded-[2rem] bg-[linear-gradient(145deg,#ddd0bd_0%,#f7f2ea_50%,#c0d3c1_100%)] p-6">
            <div className="text-sm uppercase tracking-[0.24em] text-stone-500">{t.listMap}</div>
            <div className="mt-6 grid h-[360px] place-items-center rounded-[1.5rem] border border-dashed border-stone-400/60 bg-white/60 text-center text-stone-600">
              Mapbox-integrated map panel
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
