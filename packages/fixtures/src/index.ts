import type { AlertDefinition, ListingCluster, ProjectSummary } from "@jinka-eg/types";

export const mockListings: ListingCluster[] = [
  {
    id: "cluster-new-cairo-001",
    title: { en: "Modern apartment in New Cairo", ar: "شقة حديثة في القاهرة الجديدة" },
    price: { amount: 4200000, currency: "EGP", period: "total" },
    purpose: "sale",
    marketSegment: "resale",
    propertyType: "apartment",
    area: {
      id: "new-cairo",
      slug: "new-cairo",
      name: { en: "New Cairo", ar: "القاهرة الجديدة" }
    },
    location: { lat: 30.0155, lng: 31.4913 },
    bedrooms: 3,
    bathrooms: 2,
    areaSqm: 165,
    variantCount: 2,
    variants: [
      {
        id: "variant-nawy-001",
        source: "nawy",
        sourceListingId: "nawy-001",
        sourceUrl: "https://www.nawy.com/example-1",
        title: { en: "Modern apartment in New Cairo", ar: "شقة حديثة في القاهرة الجديدة" },
        description: {
          en: "Bright resale apartment near services.",
          ar: "شقة إعادة بيع مشرقة بالقرب من الخدمات."
        },
        purpose: "sale",
        marketSegment: "resale",
        propertyType: "apartment",
        price: { amount: 4200000, currency: "EGP", period: "total" },
        bedrooms: 3,
        bathrooms: 2,
        areaSqm: 165,
        compoundName: { en: "Mivida", ar: "ميفيدا" },
        developerName: { en: "Emaar", ar: "إعمار" },
        location: { lat: 30.0155, lng: 31.4913 },
        imageUrls: ["https://images.example.com/nawy-001.jpg"],
        publishedAt: "2026-03-08T09:00:00.000Z",
        extractionConfidence: 0.96
      },
      {
        id: "variant-pf-002",
        source: "property_finder",
        sourceListingId: "pf-002",
        sourceUrl: "https://www.propertyfinder.eg/example-2",
        title: { en: "Apartment in Mivida", ar: "شقة في ميفيدا" },
        description: {
          en: "Well-kept apartment with strong resale potential.",
          ar: "شقة بحالة ممتازة وقيمة إعادة بيع قوية."
        },
        purpose: "sale",
        marketSegment: "resale",
        propertyType: "apartment",
        price: { amount: 4250000, currency: "EGP", period: "total" },
        bedrooms: 3,
        bathrooms: 2,
        areaSqm: 165,
        compoundName: { en: "Mivida", ar: "ميفيدا" },
        developerName: { en: "Emaar", ar: "إعمار" },
        location: { lat: 30.0156, lng: 31.4911 },
        imageUrls: ["https://images.example.com/pf-002.jpg"],
        publishedAt: "2026-03-08T08:56:00.000Z",
        extractionConfidence: 0.92
      }
    ],
    fraudAssessment: {
      label: "safe",
      score: 0.11,
      reasons: ["Price aligns with local comps", "Images reused across trusted sources only"]
    },
    freshnessMinutes: 4
  }
];

export const mockProjects: ProjectSummary[] = [
  {
    id: "project-zed-east",
    name: { en: "ZED East", ar: "زد إيست" },
    developerName: { en: "ORA Developers", ar: "أورا للتطوير" },
    area: {
      id: "new-cairo",
      slug: "new-cairo",
      name: { en: "New Cairo", ar: "القاهرة الجديدة" }
    },
    handoffYear: 2028,
    startingPrice: { amount: 7900000, currency: "EGP", period: "total" },
    paymentPlanYears: 8,
    imageUrl: "https://images.example.com/zed-east.jpg",
    sourceUrls: ["https://www.nawy.com/projects/zed-east"]
  }
];

export const mockAlerts: AlertDefinition[] = [
  {
    id: "alert-001",
    name: "New Cairo 3BR",
    locale: "en",
    filters: {
      locale: "en",
      purpose: "sale",
      areaIds: ["new-cairo"],
      bedrooms: [3],
      maxPrice: 5000000
    },
    notifyByPush: true,
    notifyByEmail: true,
    quietHoursStart: "23:00",
    quietHoursEnd: "07:00"
  }
];
