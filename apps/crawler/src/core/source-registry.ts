import type { ListingSource } from "@jinka-eg/types";

import { AqarmapConnector } from "../connectors/aqarmap.connector.js";
import { FacebookConnector } from "../connectors/facebook.connector.js";
import { NawyConnector } from "../connectors/nawy.connector.js";
import { PropertyFinderConnector } from "../connectors/property-finder.connector.js";
import type { SourceConnector } from "./connector.js";

const connectors: Record<ListingSource, SourceConnector> = {
  nawy: new NawyConnector(),
  property_finder: new PropertyFinderConnector(),
  aqarmap: new AqarmapConnector(),
  facebook: new FacebookConnector()
};

export function getConnector(source: ListingSource) {
  return connectors[source];
}

export function listConnectors() {
  return Object.values(connectors);
}
