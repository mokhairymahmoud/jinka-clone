export type Locale = "en" | "ar";

export type UserRole = "user" | "ops_reviewer" | "admin";

export type ListingSource = "nawy" | "property_finder" | "aqarmap" | "facebook";

export type ListingPurpose = "rent" | "sale";

export type MarketSegment = "resale" | "primary" | "off_plan";

export type SearchSort = "relevance" | "newest" | "price_asc" | "price_desc";

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
export type AreaType = "governorate" | "city" | "area";

export interface LocalizedText {
  en: string;
  ar: string;
}

export interface AreaReference {
  id: string;
  name: LocalizedText;
  slug: string;
  type?: AreaType;
  parentId?: string;
}

export interface GeoNodeReference {
  id: string;
  slug: string;
  type: AreaType;
  name: LocalizedText;
  parentId?: string;
}

export interface ListingGeoReference {
  governorate?: GeoNodeReference;
  city?: GeoNodeReference;
  area?: GeoNodeReference;
  leaf?: GeoNodeReference;
  confidence?: number;
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

export interface SearchBoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
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
  geo?: ListingGeoReference;
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
  geo?: ListingGeoReference;
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
  sort?: SearchSort;
  bbox?: SearchBoundingBox;
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

export interface FavoriteRecord {
  id: string;
  clusterId: string;
  note?: string;
  state: "saved" | "shortlisted";
  listing: ListingCluster;
}

export interface ShortlistItemRecord {
  id: string;
  clusterId: string;
  note?: string;
  addedAt: string;
  listing: ListingCluster;
}

export interface ShortlistCommentRecord {
  id: string;
  body: string;
  listingId?: string;
  createdAt: string;
  author: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface ShortlistRecord {
  id: string;
  name: string;
  description?: string;
  members: Array<{
    id: string;
    email: string;
    name?: string;
    role: string;
  }>;
  items: ShortlistItemRecord[];
  comments: ShortlistCommentRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ReportRecord {
  id: string;
  clusterId: string;
  reason: string;
  details?: string;
  resolved: boolean;
  resolutionNote?: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: "new_listing" | "price_drop";
  createdAt: string;
  readAt?: string | null;
  alertId?: string;
  alertName?: string;
  clusterId?: string;
  listing?: ListingCluster;
}
