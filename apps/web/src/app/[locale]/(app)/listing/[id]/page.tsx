import Link from "next/link";
import { notFound } from "next/navigation";

import { mockListings } from "@jinka-eg/fixtures";
import { Badge, Card } from "@jinka-eg/ui";
import { resolveLocale } from "../../../../../i18n/messages";

export default async function ListingDetailPage({
  params
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const safeLocale = resolveLocale(locale);
  const listing = mockListings.find((item) => item.id === id);

  if (!listing) notFound();

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] bg-[linear-gradient(135deg,#1f1f1f_0%,#5a6b53_45%,#c4955b_100%)] p-8 text-white">
        <Badge tone={listing.fraudAssessment.label === "safe" ? "success" : "danger"}>
          {listing.fraudAssessment.label.replace("_", " ")}
        </Badge>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight">{listing.title[safeLocale]}</h1>
        <p className="mt-3 text-lg text-white/80">{listing.area.name[safeLocale]}</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div className="text-3xl font-semibold text-stone-950">
              EGP {new Intl.NumberFormat("en-US").format(listing.price.amount)}
            </div>
            <div className="text-sm text-stone-500">{listing.variantCount} source variants</div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm text-stone-600">
            <div>{listing.bedrooms} bed</div>
            <div>{listing.bathrooms} bath</div>
            <div>{listing.areaSqm} sqm</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-stone-900">Fraud and trust explanation</div>
            <ul className="mt-3 list-disc space-y-2 ps-6 text-stone-600">
              {listing.fraudAssessment.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        </Card>
        <Card className="space-y-4 p-6">
          <div className="text-sm font-semibold text-stone-900">Source variants</div>
          {listing.variants.map((variant) => (
            <div key={variant.id} className="rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-stone-900">{variant.source}</div>
                <Badge tone="neutral">{Math.round(variant.extractionConfidence * 100)}% parse confidence</Badge>
              </div>
              <div className="mt-2 text-sm text-stone-600">{variant.title[safeLocale]}</div>
              <Link href={variant.sourceUrl} className="mt-4 inline-flex text-sm font-semibold text-clay">
                Open original source
              </Link>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
