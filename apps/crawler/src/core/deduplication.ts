type ComparisonReason = {
  code: string;
  message: string;
  weight: number;
};

export type DedupComparableListing = {
  variantId: string;
  clusterId?: string | null;
  source: string;
  sourceListingId: string;
  canonicalUrl: string;
  purpose: string;
  marketSegment: string;
  propertyType: string;
  priceAmount: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaSqm?: number | null;
  areaSlug?: string | null;
  titleEn: string;
  titleAr: string;
  compoundName?: string | null;
  developerName?: string | null;
  coordinates?: { lat: number; lng: number } | null;
  mediaHashes: string[];
};

export type DedupDecision = "no_match" | "review" | "auto_attach";

export type DedupScore = {
  score: number;
  decision: DedupDecision;
  reasons: ComparisonReason[];
};

export const REVIEW_EDGE_THRESHOLD = 0.45;
export const AUTO_ATTACH_EDGE_THRESHOLD = 0.72;

export function scoreDuplicateCandidate(left: DedupComparableListing, right: DedupComparableListing): DedupScore {
  if (
    left.variantId === right.variantId ||
    left.purpose !== right.purpose ||
    left.marketSegment !== right.marketSegment ||
    left.propertyType !== right.propertyType
  ) {
    return { score: 0, decision: "no_match", reasons: [] };
  }

  const reasons: ComparisonReason[] = [];
  let score = 0;

  const sameUrl = normalizeUrl(left.canonicalUrl) === normalizeUrl(right.canonicalUrl);
  if (sameUrl) {
    score += pushReason(reasons, "same_url", "Canonical URL matched after normalization.", 0.42);
  }

  const sameArea = Boolean(left.areaSlug && right.areaSlug && left.areaSlug === right.areaSlug);
  if (sameArea) {
    score += pushReason(reasons, "same_area", "Area slug matched.", 0.1);
  }

  const compoundSimilarity = stringSimilarity(left.compoundName, right.compoundName);
  if (compoundSimilarity >= 0.92) {
    score += pushReason(reasons, "same_compound", "Compound or project name matched.", 0.14);
  } else if (compoundSimilarity >= 0.8) {
    score += pushReason(reasons, "similar_compound", "Compound or project names are close.", 0.08);
  }

  const developerSimilarity = stringSimilarity(left.developerName, right.developerName);
  if (developerSimilarity >= 0.92) {
    score += pushReason(reasons, "same_developer", "Developer name matched.", 0.09);
  } else if (developerSimilarity >= 0.8) {
    score += pushReason(reasons, "similar_developer", "Developer names are close.", 0.05);
  }

  const titleOverlap = tokenOverlap(
    [left.titleEn, left.titleAr].filter(Boolean).join(" "),
    [right.titleEn, right.titleAr].filter(Boolean).join(" ")
  );
  if (titleOverlap >= 0.78) {
    score += pushReason(reasons, "title_overlap_high", "Title tokens overlap strongly.", 0.16);
  } else if (titleOverlap >= 0.58) {
    score += pushReason(reasons, "title_overlap_mid", "Title tokens overlap.", 0.1);
  }

  if (left.bedrooms !== null && left.bedrooms !== undefined && left.bedrooms === right.bedrooms) {
    score += pushReason(reasons, "same_bedrooms", "Bedroom count matched.", 0.07);
  }

  if (left.bathrooms !== null && left.bathrooms !== undefined && left.bathrooms === right.bathrooms) {
    score += pushReason(reasons, "same_bathrooms", "Bathroom count matched.", 0.05);
  }

  const areaDelta = relativeDelta(left.areaSqm, right.areaSqm);
  if (areaDelta !== null && areaDelta <= 0.08) {
    score += pushReason(reasons, "same_area_sqm", "Area size is within 8%.", 0.12);
  } else if (areaDelta !== null && areaDelta <= 0.18) {
    score += pushReason(reasons, "similar_area_sqm", "Area size is within 18%.", 0.06);
  }

  const priceDelta = relativeDelta(left.priceAmount, right.priceAmount);
  if (priceDelta !== null && priceDelta <= 0.05) {
    score += pushReason(reasons, "same_price", "Price is within 5%.", 0.18);
  } else if (priceDelta !== null && priceDelta <= 0.12) {
    score += pushReason(reasons, "similar_price", "Price is within 12%.", 0.1);
  } else if (priceDelta !== null && priceDelta <= 0.2) {
    score += pushReason(reasons, "near_price", "Price is within 20%.", 0.05);
  }

  const sharedImages = intersectCount(left.mediaHashes, right.mediaHashes);
  if (sharedImages > 0) {
    score += pushReason(
      reasons,
      "shared_media",
      sharedImages === 1 ? "One media hash matched." : `${sharedImages} media hashes matched.`,
      sharedImages >= 2 ? 0.24 : 0.18
    );
  }

  const distanceKm = haversineKm(left.coordinates, right.coordinates);
  if (distanceKm !== null && distanceKm <= 0.35) {
    score += pushReason(reasons, "same_coordinates", "Coordinates are within 350m.", 0.14);
  } else if (distanceKm !== null && distanceKm <= 1.2) {
    score += pushReason(reasons, "near_coordinates", "Coordinates are within 1.2km.", 0.08);
  }

  const boundedScore = Number(Math.min(score, 0.99).toFixed(3));

  return {
    score: boundedScore,
    decision:
      boundedScore >= AUTO_ATTACH_EDGE_THRESHOLD
        ? "auto_attach"
        : boundedScore >= REVIEW_EDGE_THRESHOLD
          ? "review"
          : "no_match",
    reasons
  };
}

function pushReason(reasons: ComparisonReason[], code: string, message: string, weight: number) {
  reasons.push({
    code,
    message,
    weight: Number(weight.toFixed(3))
  });

  return weight;
}

function normalizeUrl(url: string) {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

function normalizeText(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ");
}

function tokenize(value?: string | null) {
  return new Set(
    normalizeText(value)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  );
}

function tokenOverlap(left?: string | null, right?: string | null) {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let shared = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      shared += 1;
    }
  }

  return shared / Math.max(leftTokens.size, rightTokens.size);
}

function stringSimilarity(left?: string | null, right?: string | null) {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  return tokenOverlap(normalizedLeft, normalizedRight);
}

function relativeDelta(left?: number | null, right?: number | null) {
  if (left === null || left === undefined || right === null || right === undefined || left <= 0 || right <= 0) {
    return null;
  }

  return Math.abs(left - right) / Math.max(left, right);
}

function intersectCount(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const set = new Set(left);
  return right.reduce((count, hash) => count + (set.has(hash) ? 1 : 0), 0);
}

function haversineKm(
  left?: {
    lat: number;
    lng: number;
  } | null,
  right?: {
    lat: number;
    lng: number;
  } | null
) {
  if (!left || !right) {
    return null;
  }

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(right.lat - left.lat);
  const deltaLng = toRadians(right.lng - left.lng);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(left.lat)) *
      Math.cos(toRadians(right.lat)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
