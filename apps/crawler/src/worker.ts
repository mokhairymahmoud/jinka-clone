import { queueNames } from "@jinka-eg/config";
import { IngestionPipeline } from "./core/ingestion-pipeline.js";
import { closeQueues, createQueues, createRedisConnection } from "./core/queue.js";
import { closeWorkers, createWorkers } from "./core/workers.js";

async function main() {
  const connection = createRedisConnection();
  const queues = createQueues(connection);
  const pipeline = new IngestionPipeline(queues);
  const workers = createWorkers(pipeline);

  console.log(`Phase 2 ingestion workers listening on queues: ${queueNames.join(", ")}`);

  const shutdown = async () => {
    await closeWorkers(workers);
    await closeQueues(queues);
    await pipeline.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void main();
