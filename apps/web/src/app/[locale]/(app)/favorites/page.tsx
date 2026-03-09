import { mockListings } from "@jinka-eg/fixtures";
import { Badge } from "@jinka-eg/ui";

import { ListingCard } from "../../../../components/listing-card";
import { getMessages, resolveLocale } from "../../../../i18n/messages";

export default async function FavoritesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);

  return (
    <div className="space-y-8">
      <div>
        <Badge tone="accent">{t.navFavorites}</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">{t.favoritesTitle}</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {mockListings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} locale={safeLocale} />
        ))}
      </div>
    </div>
  );
}
