import type { ListingVariant } from "@jinka-eg/types";

function normalizedNumber(value?: number) {
  return typeof value === "number" ? value : 0;
}

export function scoreListingSimilarity(left: ListingVariant, right: ListingVariant) {
  let score = 0;
  const reasons: string[] = [];

  if (left.source === right.source && left.sourceListingId === right.sourceListingId) {
    return { score: 1, reasons: ["Exact source identifier match"] };
  }

  if (left.compoundName?.en && left.compoundName.en === right.compoundName?.en) {
    score += 0.2;
    reasons.push("Compound match");
  }

  if (left.developerName?.en && left.developerName.en === right.developerName?.en) {
    score += 0.15;
    reasons.push("Developer match");
  }

  if (normalizedNumber(left.bedrooms) === normalizedNumber(right.bedrooms)) {
    score += 0.12;
    reasons.push("Bedrooms align");
  }

  if (normalizedNumber(left.bathrooms) === normalizedNumber(right.bathrooms)) {
    score += 0.08;
    reasons.push("Bathrooms align");
  }

  if (Math.abs(normalizedNumber(left.areaSqm) - normalizedNumber(right.areaSqm)) <= 10) {
    score += 0.2;
    reasons.push("Area within tolerance");
  }

  if (Math.abs(left.price.amount - right.price.amount) <= Math.max(left.price.amount, right.price.amount) * 0.08) {
    score += 0.15;
    reasons.push("Price within tolerance");
  }

  if (left.location && right.location) {
    const latDiff = Math.abs(left.location.lat - right.location.lat);
    const lngDiff = Math.abs(left.location.lng - right.location.lng);
    if (latDiff < 0.002 && lngDiff < 0.002) {
      score += 0.1;
      reasons.push("Coordinates are near-identical");
    }
  }

  return { score: Math.min(score, 0.99), reasons };
}
