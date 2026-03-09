import { Badge, Card } from "@jinka-eg/ui";

import { mockListings } from "@jinka-eg/fixtures";
import { getMessages, resolveLocale } from "../../../../../i18n/messages";

export default async function ShortlistPage({
  params
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);

  return (
    <div className="space-y-8">
      <div>
        <Badge tone="accent">{t.shortlist}</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">
          {t.shortlistTitle}: {id}
        </h1>
      </div>
      <div className="grid gap-4">
        {mockListings.map((listing) => (
          <Card key={listing.id} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-stone-950">{listing.title[safeLocale]}</div>
                <div className="mt-1 text-sm text-stone-600">{listing.area.name[safeLocale]}</div>
              </div>
              <Badge tone="neutral">{listing.variantCount} variants</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
