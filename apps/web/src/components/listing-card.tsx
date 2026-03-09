import Link from "next/link";

import type { ListingCluster } from "@jinka-eg/types";
import { Badge, Card } from "@jinka-eg/ui";

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-US").format(amount);
}

export function ListingCard({
  listing,
  locale
}: {
  listing: ListingCluster;
  locale: "en" | "ar";
}) {
  const title = listing.title[locale];
  const area = listing.area.name[locale];

  return (
    <Card className="overflow-hidden">
      <div className="h-44 bg-[linear-gradient(135deg,#1f1f1f_0%,#5a6b53_50%,#c4955b_100%)] p-5 text-white">
        <div className="flex items-start justify-between">
          <Badge tone={listing.fraudAssessment.label === "safe" ? "success" : "danger"}>
            {listing.fraudAssessment.label.replace("_", " ")}
          </Badge>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs">{listing.variantCount} variants</span>
        </div>
        <div className="mt-10 max-w-xs">
          <div className="text-xs uppercase tracking-[0.24em] text-white/70">{area}</div>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h3>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-semibold text-stone-950">EGP {formatPrice(listing.price.amount)}</div>
          <Badge tone="neutral">{listing.freshnessMinutes}m ago</Badge>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm text-stone-600">
          <div>{listing.bedrooms} bed</div>
          <div>{listing.bathrooms} bath</div>
          <div>{listing.areaSqm} sqm</div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm text-stone-500">{listing.variants[0]?.source}</div>
          <Link
            href={`/${locale}/listing/${listing.id}`}
            className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
          >
            View detail
          </Link>
        </div>
      </div>
    </Card>
  );
}
