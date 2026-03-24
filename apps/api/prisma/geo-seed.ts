type GeoSeedSourceMapping = {
  source: "nawy" | "property_finder" | "aqarmap" | "facebook";
  sourceExternalId?: string;
  sourceSlug?: string;
  sourceType?: string;
};

export type GeoSeedEntry = {
  slug: string;
  type: "governorate" | "city" | "area";
  nameEn: string;
  nameAr: string;
  parentSlug?: string;
  aliases: Array<{
    alias: string;
    locale?: "en" | "ar";
  }>;
  sourceMappings?: GeoSeedSourceMapping[];
  centroid?: {
    lat: number;
    lng: number;
  };
};

export const geoSeedEntries: GeoSeedEntry[] = [
  {
    slug: "cairo",
    type: "governorate",
    nameEn: "Cairo",
    nameAr: "القاهرة",
    aliases: [
      { alias: "cairo", locale: "en" },
      { alias: "القاهرة", locale: "ar" }
    ],
    sourceMappings: [{ source: "property_finder", sourceExternalId: "2254", sourceSlug: "cairo", sourceType: "CITY" }],
    centroid: { lat: 30.0444, lng: 31.2357 }
  },
  {
    slug: "giza",
    type: "governorate",
    nameEn: "Giza",
    nameAr: "الجيزة",
    aliases: [
      { alias: "giza", locale: "en" },
      { alias: "الجيزة", locale: "ar" }
    ],
    sourceMappings: [{ source: "property_finder", sourceExternalId: "20663", sourceSlug: "giza", sourceType: "CITY" }],
    centroid: { lat: 30.0131, lng: 31.2089 }
  },
  {
    slug: "alexandria",
    type: "governorate",
    nameEn: "Alexandria",
    nameAr: "الإسكندرية",
    aliases: [
      { alias: "alexandria", locale: "en" },
      { alias: "الإسكندرية", locale: "ar" }
    ],
    centroid: { lat: 31.2001, lng: 29.9187 }
  },
  {
    slug: "new-cairo-city",
    type: "city",
    nameEn: "New Cairo City",
    nameAr: "مدينة القاهرة الجديدة",
    parentSlug: "cairo",
    aliases: [
      { alias: "new cairo city", locale: "en" },
      { alias: "new cairo", locale: "en" },
      { alias: "القاهرة الجديدة", locale: "ar" }
    ],
    sourceMappings: [
      { source: "property_finder", sourceExternalId: "2255", sourceSlug: "new-cairo-city", sourceType: "TOWN" },
      { source: "nawy", sourceSlug: "new-cairo" }
    ],
    centroid: { lat: 30.0155, lng: 31.4913 }
  },
  {
    slug: "sheikh-zayed-city",
    type: "city",
    nameEn: "Sheikh Zayed City",
    nameAr: "مدينة الشيخ زايد",
    parentSlug: "giza",
    aliases: [
      { alias: "sheikh zayed city", locale: "en" },
      { alias: "sheikh zayed", locale: "en" },
      { alias: "الشيخ زايد", locale: "ar" }
    ],
    sourceMappings: [
      { source: "property_finder", sourceExternalId: "28683", sourceSlug: "sheikh-zayed-city", sourceType: "TOWN" }
    ],
    centroid: { lat: 30.0246, lng: 30.9726 }
  },
  {
    slug: "alexandria-city",
    type: "city",
    nameEn: "Alexandria City",
    nameAr: "مدينة الإسكندرية",
    parentSlug: "alexandria",
    aliases: [
      { alias: "alexandria city", locale: "en" },
      { alias: "alexandria", locale: "en" },
      { alias: "مدينة الإسكندرية", locale: "ar" }
    ],
    centroid: { lat: 31.2001, lng: 29.9187 }
  },
  {
    slug: "new-cairo",
    type: "area",
    nameEn: "New Cairo",
    nameAr: "القاهرة الجديدة",
    parentSlug: "new-cairo-city",
    aliases: [
      { alias: "new cairo", locale: "en" },
      { alias: "القاهرة الجديدة", locale: "ar" },
      { alias: "fifth settlement", locale: "en" },
      { alias: "the fifth settlement", locale: "en" }
    ],
    sourceMappings: [
      { source: "nawy", sourceSlug: "new-cairo" },
      { source: "facebook", sourceSlug: "new-cairo" }
    ],
    centroid: { lat: 30.0155, lng: 31.4913 }
  },
  {
    slug: "mivida",
    type: "area",
    nameEn: "Mivida",
    nameAr: "ميفيدا",
    parentSlug: "new-cairo-city",
    aliases: [
      { alias: "mivida", locale: "en" }
    ],
    sourceMappings: [
      { source: "property_finder", sourceExternalId: "99999", sourceSlug: "new-cairo-mivida", sourceType: "COMPOUND" }
    ],
    centroid: { lat: 30.0187, lng: 31.4911 }
  },
  {
    slug: "eastown",
    type: "area",
    nameEn: "Eastown",
    nameAr: "إيستاون",
    parentSlug: "new-cairo-city",
    aliases: [
      { alias: "eastown", locale: "en" },
      { alias: "eastown district sodic", locale: "en" }
    ],
    sourceMappings: [{ source: "aqarmap", sourceSlug: "eastown-district-sodic" }],
    centroid: { lat: 30.0061, lng: 31.5084 }
  },
  {
    slug: "new-zayed",
    type: "area",
    nameEn: "New Zayed",
    nameAr: "زايد الجديدة",
    parentSlug: "sheikh-zayed-city",
    aliases: [
      { alias: "new zayed", locale: "en" },
      { alias: "زايد الجديدة", locale: "ar" }
    ],
    sourceMappings: [{ source: "nawy", sourceSlug: "new-zayed" }],
    centroid: { lat: 30.0599, lng: 30.8414 }
  },
  {
    slug: "6th-settlement",
    type: "area",
    nameEn: "6th Settlement",
    nameAr: "التجمع السادس",
    parentSlug: "new-cairo-city",
    aliases: [
      { alias: "6th settlement", locale: "en" },
      { alias: "sixth settlement", locale: "en" },
      { alias: "التجمع السادس", locale: "ar" }
    ],
    centroid: { lat: 29.9686, lng: 31.5691 }
  },
  {
    slug: "zed-towers",
    type: "area",
    nameEn: "ZED Towers",
    nameAr: "زد تاورز",
    parentSlug: "sheikh-zayed-city",
    aliases: [
      { alias: "zed towers", locale: "en" },
      { alias: "park side residence", locale: "en" },
      { alias: "park side residence zed towers", locale: "en" }
    ],
    sourceMappings: [
      {
        source: "property_finder",
        sourceExternalId: "41355",
        sourceSlug: "sheikh-zayed-city-sheikh-zayed-compounds-zed-towers-park-side-residence",
        sourceType: "COMPOUND"
      }
    ],
    centroid: { lat: 30.0468, lng: 31.0021 }
  },
  {
    slug: "hay-sharq",
    type: "area",
    nameEn: "Hay Sharq",
    nameAr: "حي شرق",
    parentSlug: "alexandria-city",
    aliases: [{ alias: "hay sharq", locale: "en" }],
    sourceMappings: [{ source: "property_finder", sourceSlug: "hay-sharq" }],
    centroid: { lat: 31.229, lng: 29.95 }
  },
  {
    slug: "alexandria-compounds",
    type: "area",
    nameEn: "Alexandria Compounds",
    nameAr: "كمبوندات الإسكندرية",
    parentSlug: "alexandria-city",
    aliases: [{ alias: "alexandria compounds", locale: "en" }],
    sourceMappings: [{ source: "property_finder", sourceSlug: "alexandria-compounds" }],
    centroid: { lat: 31.2083, lng: 29.9092 }
  },
  {
    slug: "hay-awal-el-montazah",
    type: "area",
    nameEn: "Hay Awal El Montazah",
    nameAr: "حي أول المنتزه",
    parentSlug: "alexandria-city",
    aliases: [{ alias: "hay awal el montazah", locale: "en" }],
    sourceMappings: [{ source: "property_finder", sourceSlug: "hay-awal-el-montazah" }],
    centroid: { lat: 31.2784, lng: 30.0044 }
  },
  {
    slug: "hay-wasat",
    type: "area",
    nameEn: "Hay Wasat",
    nameAr: "حي وسط",
    parentSlug: "alexandria-city",
    aliases: [{ alias: "hay wasat", locale: "en" }],
    sourceMappings: [{ source: "property_finder", sourceSlug: "hay-wasat" }],
    centroid: { lat: 31.2057, lng: 29.9245 }
  },
  {
    slug: "hay-than-el-montazah",
    type: "area",
    nameEn: "Hay Than El Montazah",
    nameAr: "حي ثان المنتزه",
    parentSlug: "alexandria-city",
    aliases: [{ alias: "hay than el montazah", locale: "en" }],
    sourceMappings: [{ source: "property_finder", sourceSlug: "hay-than-el-montazah" }],
    centroid: { lat: 31.2901, lng: 30.0286 }
  }
];
