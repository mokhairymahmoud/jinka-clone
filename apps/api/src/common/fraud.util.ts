export interface FraudFeatures {
  priceDeviationRatio: number;
  conflictingLocation: boolean;
  suspiciousContactReuse: boolean;
  imageReuseAcrossLowTrustSources: boolean;
  suspiciousPostingCadence: boolean;
  contradictoryCrossSourceData: boolean;
}

const coefficients = {
  intercept: -2.25,
  priceDeviationRatio: 2.7,
  conflictingLocation: 1.1,
  suspiciousContactReuse: 1.3,
  imageReuseAcrossLowTrustSources: 1.5,
  suspiciousPostingCadence: 0.9,
  contradictoryCrossSourceData: 1.4
};

export function scoreFraud(features: FraudFeatures) {
  const rawScore =
    coefficients.intercept +
    features.priceDeviationRatio * coefficients.priceDeviationRatio +
    Number(features.conflictingLocation) * coefficients.conflictingLocation +
    Number(features.suspiciousContactReuse) * coefficients.suspiciousContactReuse +
    Number(features.imageReuseAcrossLowTrustSources) * coefficients.imageReuseAcrossLowTrustSources +
    Number(features.suspiciousPostingCadence) * coefficients.suspiciousPostingCadence +
    Number(features.contradictoryCrossSourceData) * coefficients.contradictoryCrossSourceData;

  const probability = 1 / (1 + Math.exp(-rawScore));

  if (probability >= 0.8) {
    return { label: "high_risk" as const, score: Number(probability.toFixed(3)) };
  }

  if (probability >= 0.35) {
    return { label: "review" as const, score: Number(probability.toFixed(3)) };
  }

  return { label: "safe" as const, score: Number(probability.toFixed(3)) };
}
