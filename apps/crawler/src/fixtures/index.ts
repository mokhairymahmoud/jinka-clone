import { readFileSync } from "node:fs";

import nawySearch from "./nawy.search.json";
import propertyFinderSearch from "./property-finder.search.json";

import type { ListingSource } from "@jinka-eg/types";
import type { RawPageResult } from "../core/connector.js";

export function getParserFixture(source: ListingSource): RawPageResult {
  if (source === "nawy") {
    return {
      source,
      url: "https://www.nawy.com/search?purpose=sale&area=new-cairo",
      payloadType: "json",
      body: JSON.stringify(nawySearch),
      fetchedAt: "2026-03-09T00:00:00.000Z"
    };
  }

  if (source === "property_finder") {
    return {
      source,
      url: "https://www.propertyfinder.eg/en/search?l=1864",
      payloadType: "json",
      body: JSON.stringify(propertyFinderSearch),
      fetchedAt: "2026-03-09T00:00:00.000Z"
    };
  }

  if (source === "aqarmap") {
    return {
      source,
      url: "https://aqarmap.com.eg/en/listing/987654",
      payloadType: "html",
      body: readFileSync(new URL("./aqarmap.listing.html", import.meta.url), "utf8"),
      fetchedAt: "2026-03-10T00:00:00.000Z"
    };
  }

  throw new Error(`No parser fixture configured for source ${source}`);
}
