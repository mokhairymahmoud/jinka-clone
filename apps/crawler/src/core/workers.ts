import { Worker } from "bullmq";

import type { IngestionPipeline } from "./ingestion-pipeline.js";
import { createRedisConnection } from "./queue.js";

export function createWorkers(pipeline: IngestionPipeline) {
  const workers = [
    new Worker("seed-source", async (job) => pipeline.handleSeedSource(job.data), {
      connection: createRedisConnection()
    }),
    new Worker("fetch-page", async (job) => pipeline.handleFetchPage(job.data), {
      connection: createRedisConnection()
    }),
    new Worker("parse-snapshot", async (job) => pipeline.handleParseSnapshot(job.data), {
      connection: createRedisConnection()
    }),
    new Worker("normalize-variant", async (job) => pipeline.handleNormalizeVariant(job.data), {
      connection: createRedisConnection()
    }),
    ...(["score-cluster", "score-fraud", "match-alerts", "send-notification"] as const).map(
      (queueName) =>
        new Worker(queueName, async (job) => pipeline.handleNoopStage(job.data), {
          connection: createRedisConnection()
        })
    )
  ];

  for (const worker of workers) {
    worker.on("failed", (job, error) => {
      void pipeline.markRunFailed(job?.data?.runId, error.message);
    });
  }

  return workers;
}

export async function closeWorkers(workers: Worker[]) {
  await Promise.all(workers.map((worker) => worker.close()));
}
