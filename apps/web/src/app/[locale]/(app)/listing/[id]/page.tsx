import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge, Card } from "@jinka-eg/ui";
import { FavoriteButton } from "../../../../../components/favorite-button";
import { ReportListingForm } from "../../../../../components/report-listing-form";
import { apiFetch } from "../../../../../lib/api";
import { resolveLocale } from "../../../../../i18n/messages";
import { getAccessTokenFromCookies } from "../../../../../lib/server-api";

export default async function ListingDetailPage({
  params
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const safeLocale = resolveLocale(locale);
  const [listingResponse, favoritesResponse] = await Promise.all([
    apiFetch(`/v1/listings/${id}`),
    (async () => {
      const accessToken = await getAccessTokenFromCookies();
      if (!accessToken) return null;
      return apiFetch("/v1/favorites", {
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });
    })()
  ]);

  if (!listingResponse.ok) notFound();

  const listing = (await listingResponse.json()) as Parameters<typeof FavoriteButton>[0] & {
    id: string;
    title: { en: string; ar: string };
    area: { name: { en: string; ar: string } };
    fraudAssessment: { label: "safe" | "review" | "high_risk"; reasons: string[] };
    price: { amount: number };
    variantCount: number;
    bedrooms?: number;
    bathrooms?: number;
    areaSqm?: number;
    variants: Array<{
      id: string;
      source: string;
      extractionConfidence: number;
      title: { en: string; ar: string };
      sourceUrl: string;
    }>;
  };
  const favorites = favoritesResponse && favoritesResponse.ok ? await favoritesResponse.json() : [];
  const isFavorite = (favorites as Array<{ clusterId: string }>).some((favorite) => favorite.clusterId === listing.id);

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-[var(--jinka-border)] bg-[var(--jinka-surface)] p-6 shadow-[var(--jinka-shadow)]">
        <Badge tone={listing.fraudAssessment.label === "safe" ? "success" : "danger"}>
          {listing.fraudAssessment.label.replace("_", " ")}
        </Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--jinka-text)]">{listing.title[safeLocale]}</h1>
        <p className="mt-3 text-lg text-[var(--jinka-muted)]">{listing.area.name[safeLocale]}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="rounded-full bg-[var(--jinka-surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--jinka-text)]">
            EGP {new Intl.NumberFormat("en-US").format(listing.price.amount)}
          </div>
          <FavoriteButton clusterId={listing.id} initialSaved={isFavorite} />
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="space-y-6 border-[var(--jinka-border)] p-6 shadow-[var(--jinka-shadow)]">
          <div className="flex items-center justify-between">
            <div className="text-3xl font-semibold text-[var(--jinka-text)]">
              EGP {new Intl.NumberFormat("en-US").format(listing.price.amount)}
            </div>
            <div className="text-sm text-[var(--jinka-muted)]">{listing.variantCount} source variants</div>
          </div>
          <div className="grid grid-cols-3 gap-4 rounded-[24px] bg-[var(--jinka-surface-muted)] p-4 text-sm text-[var(--jinka-muted)]">
            <div>{listing.bedrooms} bed</div>
            <div>{listing.bathrooms} bath</div>
            <div>{listing.areaSqm} sqm</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--jinka-text)]">Why this listing was scored this way</div>
            <ul className="mt-3 list-disc space-y-2 ps-6 text-[var(--jinka-muted)]">
              {listing.fraudAssessment.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        </Card>
        <Card className="space-y-4 border-[var(--jinka-border)] p-6 shadow-[var(--jinka-shadow)]">
          <div className="text-sm font-semibold text-[var(--jinka-text)]">Original sources</div>
          {listing.variants.map((variant) => (
            <div key={variant.id} className="rounded-[24px] border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-[var(--jinka-text)]">{variant.source}</div>
                <Badge tone="neutral">{Math.round(variant.extractionConfidence * 100)}% parse confidence</Badge>
              </div>
              <div className="mt-2 text-sm text-[var(--jinka-muted)]">{variant.title[safeLocale]}</div>
              <Link
                href={variant.sourceUrl}
                className="mt-4 inline-flex rounded-full border border-[var(--jinka-border)] bg-[var(--jinka-surface)] px-4 py-2 text-sm font-semibold text-[var(--jinka-text)]"
              >
                Open original source
              </Link>
            </div>
          ))}
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-1">
        <ReportListingForm clusterId={listing.id} />
      </div>
    </div>
  );
}
