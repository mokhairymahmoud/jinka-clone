export type Locale = "en" | "ar";

export type UserRole = "user" | "ops_reviewer" | "admin";

export type ListingSource = "nawy" | "property_finder" | "aqarmap" | "facebook";

export type ListingPurpose = "rent" | "sale";

export type MarketSegment = "resale" | "primary" | "off_plan";

export type PropertyType =
  | "apartment"
  | "villa"
  | "townhouse"
  | "twin_house"
  | "duplex"
  | "penthouse"
  | "studio"
  | "office"
  | "retail"
  | "land";

export type FraudLabel = "safe" | "review" | "high_risk";

export interface LocalizedText {
  en: string;
  ar: string;
}

export interface AreaReference {
  id: string;
  name: LocalizedText;
  slug: string;
}

export interface PriceAmount {
  amount: number;
  currency: "EGP";
  period?: "monthly" | "total";
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ListingVariant {
  id: string;
  source: ListingSource;
  sourceListingId: string;
  sourceUrl: string;
  title: LocalizedText;
  description: LocalizedText;
  purpose: ListingPurpose;
  marketSegment: MarketSegment;
  propertyType: PropertyType;
  price: PriceAmount;
  bedrooms?: number;
  bathrooms?: number;
  areaSqm?: number;
  compoundName?: LocalizedText;
  developerName?: LocalizedText;
  location?: Coordinates;
  imageUrls: string[];
  publishedAt: string;
  extractionConfidence: number;
}

export interface FraudAssessment {
  label: FraudLabel;
  score: number;
  reasons: string[];
}

export interface ListingCluster {
  id: string;
  title: LocalizedText;
  price: PriceAmount;
  purpose: ListingPurpose;
  marketSegment: MarketSegment;
  propertyType: PropertyType;
  area: AreaReference;
  location?: Coordinates;
  bedrooms?: number;
  bathrooms?: number;
  areaSqm?: number;
  projectId?: string;
  variantCount: number;
  variants: ListingVariant[];
  fraudAssessment: FraudAssessment;
  freshnessMinutes: number;
}

export interface ProjectSummary {
  id: string;
  name: LocalizedText;
  developerName: LocalizedText;
  area: AreaReference;
  handoffYear?: number;
  startingPrice?: PriceAmount;
  paymentPlanYears?: number;
  imageUrl: string;
  sourceUrls: string[];
}

export interface SearchFilters {
  locale?: Locale;
  query?: string;
  purpose?: ListingPurpose;
  marketSegment?: MarketSegment;
  propertyTypes?: PropertyType[];
  areaIds?: string[];
  bedrooms?: number[];
  bathrooms?: number[];
  minPrice?: number;
  maxPrice?: number;
  minAreaSqm?: number;
  maxAreaSqm?: number;
  compoundIds?: string[];
  developerIds?: string[];
}

export interface AlertDefinition {
  id: string;
  name: string;
  locale: Locale;
  filters: SearchFilters;
  notifyByPush: boolean;
  notifyByEmail: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}
