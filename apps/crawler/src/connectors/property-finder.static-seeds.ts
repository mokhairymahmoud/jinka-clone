import type { SourceSeed } from "../core/connector.js";

type PropertyFinderStaticSeed = Pick<
  SourceSeed,
  "label" | "areaSlug" | "url" | "priority"
>;

export const propertyFinderStaticBuyApartmentSeeds = [
  // {
  //   label: "pf-buy-apartment-new-cairo-city",
  //   areaSlug: "new-cairo-city",
  //   url: "https://www.propertyfinder.eg/en/buy/cairo/apartments-for-sale-new-cairo-city.html",
  //   priority: 10
  // },
  // {
  //   label: "pf-buy-apartment-sheikh-zayed-city",
  //   areaSlug: "sheikh-zayed-city",
  //   url: "https://www.propertyfinder.eg/en/buy/giza/apartments-for-sale-sheikh-zayed-city.html",
  //   priority: 10
  // },
  // {
  //   label: "pf-buy-apartment-6-october-city",
  //   areaSlug: "6-october-city",
  //   url: "https://www.propertyfinder.eg/en/buy/giza/apartments-for-sale-6-october-city.html",
  //   priority: 10
  // },
  // {
  //   label: "pf-buy-apartment-mostakbal-city-future-city",
  //   areaSlug: "mostakbal-city-future-city",
  //   url: "https://www.propertyfinder.eg/en/buy/cairo/apartments-for-sale-mostakbal-city-future-city.html",
  //   priority: 10
  // },
  // {
  //   label: "pf-buy-apartment-new-capital-city",
  //   areaSlug: "new-capital-city",
  //   url: "https://www.propertyfinder.eg/en/buy/cairo/apartments-for-sale-new-capital-city.html",
  //   priority: 10
  // },
  // {
  //   label: "pf-buy-apartment-madinaty",
  //   areaSlug: "madinaty",
  //   url: "https://www.propertyfinder.eg/en/buy/cairo/apartments-for-sale-madinaty.html",
  //   priority: 10
  // },
  // {
  //   label: "pf-buy-apartment-al-alamein",
  //   areaSlug: "al-alamein",
  //   url: "https://www.propertyfinder.eg/en/buy/north-coast/apartments-for-sale-al-alamein.html",
  //   priority: 10
  // },
  // {
  //   label: "pf-buy-apartment-sidi-abdel-rahman",
  //   areaSlug: "sidi-abdel-rahman",
  //   url: "https://www.propertyfinder.eg/en/buy/north-coast/apartments-for-sale-sidi-abdel-rahman.html",
  //   priority: 10
  // },
  // {
  //   label: "pf-buy-apartment-ras-al-hekma",
  //   areaSlug: "ras-al-hekma",
  //   url: "https://www.propertyfinder.eg/en/buy/north-coast/apartments-for-sale-ras-al-hekma.html",
  //   priority: 10
  // },
  // {
  //   label: "pf-buy-apartment-hurghada",
  //   areaSlug: "hurghada",
  //   url: "https://www.propertyfinder.eg/en/buy/red-sea/apartments-for-sale-hurghada.html",
  //   priority: 10
  // },
  // {
  //   label: "pf-buy-apartment-al-ain-al-sokhna",
  //   areaSlug: "al-ain-al-sokhna",
  //   url: "https://www.propertyfinder.eg/en/buy/suez/apartments-for-sale-al-ain-al-sokhna.html",
  //   priority: 10
  // },
  // {
  //   label: "pf-buy-apartment-obour-city",
  //   areaSlug: "obour-city",
  //   url: "https://www.propertyfinder.eg/en/buy/qalyubia/apartments-for-sale-obour-city.html",
  //   priority: 10
  // },
  // {
  //   label: "pf-buy-apartment-sharm-el-sheikh",
  //   areaSlug: "sharm-el-sheikh",
  //   url: "https://www.propertyfinder.eg/en/buy/south-sainai/apartments-for-sale-sharm-el-sheikh.html",
  //   priority: 10
  // },
  // {
  //   label: "pf-buy-apartment-cairo",
  //   areaSlug: "cairo",
  //   url: "https://www.propertyfinder.eg/en/buy/cairo/apartments-for-sale.html",
  //   priority: 20
  // },
  // {
  //   label: "pf-buy-apartment-giza",
  //   areaSlug: "giza",
  //   url: "https://www.propertyfinder.eg/en/buy/giza/apartments-for-sale.html",
  //   priority: 20
  // },
  // {
  //   label: "pf-buy-apartment-alexandria",
  //   areaSlug: "alexandria",
  //   url: "https://www.propertyfinder.eg/en/buy/alexandria/apartments-for-sale.html",
  //   priority: 20
  // },
  // {
  //   label: "pf-buy-apartment-north-coast",
  //   areaSlug: "north-coast",
  //   url: "https://www.propertyfinder.eg/en/buy/north-coast/apartments-for-sale.html",
  //   priority: 20
  // },
  // {
  //   label: "pf-buy-apartment-red-sea",
  //   areaSlug: "red-sea",
  //   url: "https://www.propertyfinder.eg/en/buy/red-sea/apartments-for-sale.html",
  //   priority: 20
  // },
  // {
  //   label: "pf-buy-apartment-suez",
  //   areaSlug: "suez",
  //   url: "https://www.propertyfinder.eg/en/buy/suez/apartments-for-sale.html",
  //   priority: 20
  // },
  // {
  //   label: "pf-buy-apartment-qalyubia",
  //   areaSlug: "qalyubia",
  //   url: "https://www.propertyfinder.eg/en/buy/qalyubia/apartments-for-sale.html",
  //   priority: 20
  // },
  // {
  //   label: "pf-buy-apartment-south-sainai",
  //   areaSlug: "south-sainai",
  //   url: "https://www.propertyfinder.eg/en/buy/south-sainai/apartments-for-sale.html",
  //   priority: 20
  // },
  // {
  //   label: "pf-buy-apartment-nasr-city",
  //   areaSlug: "nasr-city",
  //   url: "https://www.propertyfinder.eg/en/buy/cairo/apartments-for-sale-nasr-city.html",
  //   priority: 20
  // },
  // {
  //   label: "pf-buy-apartment-hay-el-maadi",
  //   areaSlug: "hay-el-maadi",
  //   url: "https://www.propertyfinder.eg/en/buy/cairo/apartments-for-sale-hay-el-maadi.html",
  //   priority: 20
  // },
  // {
  //   label: "pf-buy-apartment-shorouk-city",
  //   areaSlug: "shorouk-city",
  //   url: "https://www.propertyfinder.eg/en/buy/cairo/apartments-for-sale-shorouk-city.html",
  //   priority: 20
  // },
  // {
  //   label: "pf-buy-apartment-heliopolis-masr-el-gedida",
  //   areaSlug: "heliopolis-masr-el-gedida",
  //   url: "https://www.propertyfinder.eg/en/buy/cairo/apartments-for-sale-heliopolis-masr-el-gedida.html",
  //   priority: 20
  // },
  // {
  //   label: "pf-buy-apartment-hadayek-el-ahram",
  //   areaSlug: "hadayek-el-ahram",
  //   url: "https://www.propertyfinder.eg/en/buy/giza/apartments-for-sale-hadayek-el-ahram.html",
  //   priority: 20
  // },
  // {
  //   label: "pf-buy-apartment-mohandessin",
  //   areaSlug: "mohandessin",
  //   url: "https://www.propertyfinder.eg/en/buy/giza/apartments-for-sale-mohandessin.html",
  //   priority: 20
  // },
  // {
  //   label: "pf-buy-apartment-dokki",
  //   areaSlug: "dokki",
  //   url: "https://www.propertyfinder.eg/en/buy/giza/apartments-for-sale-dokki.html",
  //   priority: 20
  // },
  {
    label: "pf-buy-apartment-hay-sharq",
    areaSlug: "hay-sharq",
    url: "https://www.propertyfinder.eg/en/buy/alexandria/apartments-for-sale-hay-sharq.html",
    priority: 20
  },
  {
    label: "pf-buy-apartment-alexandria-compounds",
    areaSlug: "alexandria-compounds",
    url: "https://www.propertyfinder.eg/en/buy/alexandria/apartments-for-sale-alexandria-compounds.html",
    priority: 20
  },
  {
    label: "pf-buy-apartment-hay-awal-el-montazah",
    areaSlug: "hay-awal-el-montazah",
    url: "https://www.propertyfinder.eg/en/buy/alexandria/apartments-for-sale-hay-awal-el-montazah.html",
    priority: 20
  },
  {
    label: "pf-buy-apartment-hay-wasat",
    areaSlug: "hay-wasat",
    url: "https://www.propertyfinder.eg/en/buy/alexandria/apartments-for-sale-hay-wasat.html",
    priority: 20
  },
  {
    label: "pf-buy-apartment-hay-than-el-montazah",
    areaSlug: "hay-than-el-montazah",
    url: "https://www.propertyfinder.eg/en/buy/alexandria/apartments-for-sale-hay-than-el-montazah.html",
    priority: 20
  }
] as const satisfies readonly PropertyFinderStaticSeed[];
