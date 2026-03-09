import { closeQueues, createQueues, createRedisConnection } from "./core/queue.js";
import { IngestionPipeline } from "./core/ingestion-pipeline.js";

function getNumberArg(name: string) {
  const value = process.argv.find((arg) => arg.startsWith(`${name}=`))?.split("=")[1];

  if (!value) {
    return undefined;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

async function main() {
  const redis = createRedisConnection();
  const queues = createQueues(redis);
  const pipeline = new IngestionPipeline(queues);

  try {
    const result = await pipeline.backfillExistingVariants({
      limit: getNumberArg("--limit")
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await closeQueues(queues);
    await pipeline.close();
  }
}

void main();
