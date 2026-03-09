import { Badge, Card } from "@jinka-eg/ui";

import { FavoriteButton } from "../../../../../components/favorite-button";
import { ListingCard } from "../../../../../components/listing-card";
import { getMessages, resolveLocale } from "../../../../../i18n/messages";
import { apiFetch } from "../../../../../lib/api";
import { getAccessTokenFromCookies } from "../../../../../lib/server-api";

type SearchPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function fetchListings(query?: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  const response = await apiFetch(`/v1/listings${params.toString() ? `?${params.toString()}` : ""}`);

  if (!response.ok) {
    return [];
  }

  return response.json();
}

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

export default async function UnitSearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);
  const query = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : "";
  const [listings, favorites] = await Promise.all([fetchListings(query), fetchFavorites()]);
  const favoriteIds = new Set((favorites as Array<{ clusterId: string }>).map((favorite) => favorite.clusterId));

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
        <Card className="grid min-w-[320px] gap-3 p-4">
          <form className="grid gap-3" method="GET">
            <div className="text-sm font-medium text-stone-500">{t.filters}</div>
            <input
              name="q"
              defaultValue={query}
              placeholder="Search area, title, or compound"
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950"
            />
            <button className="rounded-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white" type="submit">
              Search
            </button>
          </form>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-6">
          {(listings as Array<Parameters<typeof ListingCard>[0]["listing"]>).map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              locale={safeLocale}
              action={<FavoriteButton clusterId={listing.id} initialSaved={favoriteIds.has(listing.id)} />}
            />
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
