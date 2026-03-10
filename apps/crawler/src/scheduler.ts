import type { ListingSource } from "@jinka-eg/types";

import { IngestionPipeline } from "./core/ingestion-pipeline.js";
import { closeQueues, createQueues, createRedisConnection } from "./core/queue.js";

function parseSources(argv: string[]): ListingSource[] {
  const passed = argv
    .flatMap((arg) => (arg.startsWith("--source=") ? [arg.replace("--source=", "")] : []))
    .filter((source): source is ListingSource =>
      ["nawy", "property_finder", "aqarmap", "facebook"].includes(source)
    );

  return passed.length > 0 ? passed : ["nawy", "property_finder", "aqarmap", "facebook"];
}

function parseFlag(argv: string[], name: string) {
  return argv.includes(name);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const argv = process.argv.slice(2);
  const sources = parseSources(argv);
  const runOnce = parseFlag(argv, "--once");
  const intervalMs = Number(process.env.CRAWLER_SCHEDULER_INTERVAL_MS ?? "300000");
  const limit = Number(process.env.CRAWLER_PARTITION_BATCH_SIZE ?? "25");
  const redis = createRedisConnection();
  const queues = createQueues(redis);
  const pipeline = new IngestionPipeline(queues);

  const tick = async () => {
    const synced = await pipeline.syncSourcePartitions(sources);
    const queued = await pipeline.enqueueDuePartitions({
      sources,
      limit
    });
    const stale = await pipeline.markInactiveVariants({
      sources
    });

    console.log(
      JSON.stringify(
        {
          at: new Date().toISOString(),
          syncedPartitions: synced.syncedPartitions,
          queuedPartitions: queued.queuedPartitions,
          queuedSources: queued.queuedSources,
          markedInactive: stale.markedInactive
        },
        null,
        2
      )
    );
  };

  let stopped = false;
  const stop = () => {
    stopped = true;
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  try {
    if (runOnce) {
      await tick();
      return;
    }

    while (!stopped) {
      await tick();
      if (!stopped) {
        await sleep(intervalMs);
      }
    }
  } finally {
    await closeQueues(queues);
    await pipeline.close();
  }
}

void main();
