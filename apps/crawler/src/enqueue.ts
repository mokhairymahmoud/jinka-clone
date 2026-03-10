import type { ListingSource } from "@jinka-eg/types";

import { IngestionPipeline } from "./core/ingestion-pipeline.js";
import { closeQueues, createQueues, createRedisConnection } from "./core/queue.js";

function parseSources(argv: string[]): ListingSource[] {
  const passed = argv
    .flatMap((arg) => (arg.startsWith("--source=") ? [arg.replace("--source=", "")] : []))
    .filter((source): source is ListingSource =>
      ["nawy", "property_finder", "aqarmap", "facebook"].includes(source)
    );

  return passed.length > 0 ? passed : ["nawy", "property_finder"];
}

async function main() {
  const redis = createRedisConnection();
  const queues = createQueues(redis);
  const pipeline = new IngestionPipeline(queues);
  const sources = parseSources(process.argv.slice(2));

  const result = await pipeline.enqueueSources(sources);

  console.log(
    `Queued ingestion runs for: ${result.queuedSources.join(", ") || "none"}${result.skippedSources.length > 0 ? ` (skipped disabled: ${result.skippedSources.join(", ")})` : ""}`
  );

  await closeQueues(queues);
  await pipeline.close();
}

void main();
