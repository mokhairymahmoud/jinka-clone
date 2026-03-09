import type { ListingSource } from "@jinka-eg/types";

import { IngestionPipeline } from "./core/ingestion-pipeline.js";
import { closeQueues, createQueues, createRedisConnection } from "./core/queue.js";
import { getParserFixture } from "./fixtures/index.js";
import { getConnector } from "./core/source-registry.js";

function getArg(name: string) {
  return process.argv.find((arg) => arg.startsWith(`${name}=`))?.split("=")[1];
}

async function main() {
  const snapshotId = getArg("--snapshot");
  const fixtureSource = getArg("--fixture") as ListingSource | undefined;
  const redis = createRedisConnection();
  const queues = createQueues(redis);
  const pipeline = new IngestionPipeline(queues);

  if (snapshotId) {
    const replayed = await pipeline.replayRawSnapshot(snapshotId);
    console.log(JSON.stringify(replayed, null, 2));
  } else if (fixtureSource) {
    const connector = getConnector(fixtureSource);
    const parsed = await connector.parse(getParserFixture(fixtureSource));
    const replayed = await Promise.all(parsed.map((candidate) => connector.normalize(candidate)));

    console.log(JSON.stringify(replayed, null, 2));
  } else {
    throw new Error("Pass either --snapshot=<id> or --fixture=<source>");
  }

  await closeQueues(queues);
  await pipeline.close();
}

void main();
