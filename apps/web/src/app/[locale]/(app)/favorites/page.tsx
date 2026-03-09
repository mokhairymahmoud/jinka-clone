import { Badge } from "@jinka-eg/ui";

import { ListingCard } from "../../../../components/listing-card";
import { getMessages, resolveLocale } from "../../../../i18n/messages";
import { apiFetch } from "../../../../lib/api";
import { getAccessTokenFromCookies } from "../../../../lib/server-api";

async function fetchFavorites() {
  const accessToken = await getAccessTokenFromCookies();

  if (!accessToken) {
    return [];
  }

  const response = await apiFetch("/v1/favorites", {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
}

export default async function FavoritesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);
  const favorites = (await fetchFavorites()) as Array<{
    id: string;
    listing: Parameters<typeof ListingCard>[0]["listing"];
  }>;

  return (
    <div className="space-y-8">
      <div>
        <Badge tone="accent">{t.navFavorites}</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">{t.favoritesTitle}</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {favorites.map((favorite) => (
          <ListingCard key={favorite.id} listing={favorite.listing} locale={safeLocale} />
        ))}
      </div>
    </div>
  );
}
