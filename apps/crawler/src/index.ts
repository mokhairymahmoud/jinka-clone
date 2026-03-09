import { appLocales, queueNames } from "@jinka-eg/config";

import { AqarmapConnector } from "./connectors/aqarmap.connector.js";
import { FacebookConnector } from "./connectors/facebook.connector.js";
import { NawyConnector } from "./connectors/nawy.connector.js";
import { PropertyFinderConnector } from "./connectors/property-finder.connector.js";

async function main() {
  const connectors = [
    new NawyConnector(),
    new PropertyFinderConnector(),
    new AqarmapConnector(),
    new FacebookConnector()
  ];

  const health = await Promise.all(connectors.map((connector) => connector.healthcheck()));

  console.log(
    JSON.stringify(
      {
        locales: appLocales,
        queueNames,
        connectors: health
      },
      null,
      2
    )
  );
}

void main();
