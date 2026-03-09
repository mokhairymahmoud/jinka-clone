import { createHash } from "node:crypto";

import type {
  Coordinates,
  ListingPurpose,
  LocalizedText,
  MarketSegment,
  PriceAmount,
  PropertyType
} from "@jinka-eg/types";

type AreaSeed = {
  slug: string;
  nameEn: string;
  nameAr: string;
  aliases: string[];
  centroid: Coordinates;
};

export interface NormalizedArea {
  slug: string;
  nameEn: string;
  nameAr: string;
  centroid: Coordinates;
}

const knownAreas: AreaSeed[] = [
  {
    slug: "new-cairo",
    nameEn: "New Cairo",
    nameAr: "القاهرة الجديدة",
    aliases: ["new cairo", "القاهرة الجديدة", "fifth settlement", "the fifth settlement"],
    centroid: { lat: 30.0155, lng: 31.4913 }
  },
  {
    slug: "sheikh-zayed-city",
    nameEn: "Sheikh Zayed City",
    nameAr: "الشيخ زايد",
    aliases: ["sheikh zayed", "sheikh zayed city", "الشيخ زايد"],
    centroid: { lat: 30.0246, lng: 30.9726 }
  },
  {
    slug: "new-zayed",
    nameEn: "New Zayed",
    nameAr: "زايد الجديدة",
    aliases: ["new zayed", "زايد الجديدة"],
    centroid: { lat: 30.0599, lng: 30.8414 }
  },
  {
    slug: "6th-settlement",
    nameEn: "6th Settlement",
    nameAr: "التجمع السادس",
    aliases: ["6th settlement", "sixth settlement", "التجمع السادس"],
    centroid: { lat: 29.9686, lng: 31.5691 }
  },
  {
    slug: "giza",
    nameEn: "Giza",
    nameAr: "الجيزة",
    aliases: ["giza", "الجيزة"],
    centroid: { lat: 30.0131, lng: 31.2089 }
  }
];

const propertyTypeMap: Record<string, PropertyType> = {
  apartment: "apartment",
  apartments: "apartment",
  chalet: "apartment",
  chalets: "apartment",
  clinic: "office",
  duplex: "duplex",
  duplexes: "duplex",
  ivilla: "villa",
  ivillas: "villa",
  land: "land",
  office: "office",
  offices: "office",
  penthouse: "penthouse",
  pethouse: "penthouse",
  retail: "retail",
  shop: "retail",
  studio: "studio",
  townhouse: "townhouse",
  townhouses: "townhouse",
  twinhouse: "twin_house",
  "twin house": "twin_house",
  "twin houses": "twin_house",
  villa: "villa",
  villas: "villa"
};

export function localizeText(en: string, ar?: string): LocalizedText {
  const safeEn = en.trim();
  const safeAr = ar?.trim() || safeEn;

  return { en: safeEn, ar: safeAr };
}

export function normalizePropertyType(input?: string): PropertyType {
  if (!input) return "apartment";
  const normalized = input.trim().toLowerCase().replaceAll("-", " ");

  return propertyTypeMap[normalized] ?? "apartment";
}

export function normalizePurpose(value?: string | number): ListingPurpose {
  if (value === 2 || value === "rent") return "rent";
  return "sale";
}

export function normalizeMarketSegment(flags: {
  isDirectFromDeveloper?: boolean;
  isNewConstruction?: boolean;
  isOffPlan?: boolean;
}): MarketSegment {
  if (flags.isOffPlan) return "off_plan";
  if (flags.isDirectFromDeveloper || flags.isNewConstruction) return "primary";
  return "resale";
}

export function normalizeArea(areaName?: string, locationHints: string[] = []): NormalizedArea | null {
  const haystack = [areaName, ...locationHints]
    .filter(Boolean)
    .map((value) => value!.toLowerCase())
    .join(" | ");

  const matched = knownAreas.find((candidate) =>
    candidate.aliases.some((alias) => haystack.includes(alias.toLowerCase()))
  );

  if (matched) {
    return {
      slug: matched.slug,
      nameEn: matched.nameEn,
      nameAr: matched.nameAr,
      centroid: matched.centroid
    };
  }

  if (!areaName) {
    return null;
  }

  const slug = areaName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return {
    slug: slug || "unknown-area",
    nameEn: areaName.trim(),
    nameAr: areaName.trim(),
    centroid: { lat: 30.0444, lng: 31.2357 }
  };
}

export function resolveCoordinates(explicit?: Coordinates, area?: NormalizedArea | null): Coordinates | undefined {
  if (explicit) {
    return explicit;
  }

  return area?.centroid;
}

export function hashImageUrls(imageUrls: string[]) {
  return [...new Set(imageUrls.filter(Boolean))].map((url) =>
    createHash("sha256").update(url).digest("hex")
  );
}

export function normalizePrice(
  amount: number | null | undefined,
  currency = "EGP",
  period?: "monthly" | "total"
): PriceAmount | null {
  if (amount === null || amount === undefined || Number.isNaN(amount) || amount <= 0) {
    return null;
  }

  return {
    amount: Math.round(amount),
    currency: currency === "EGP" ? "EGP" : "EGP",
    ...(period ? { period } : {})
  };
}
