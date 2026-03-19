import type { WorkerOptions } from "bullmq";

import type { QueueName } from "./queue.js";

const defaultWorkerConcurrency: Record<QueueName, number> = {
  "seed-source": 2,
  "discover-page": 12,
  "fetch-detail": 8,
  "reconcile-variant": 24,
  "score-cluster": 4,
  "score-fraud": 4,
  "match-alerts": 4,
  "send-notification": 4
};

function toEnvSuffix(queueName: QueueName) {
  return queueName.toUpperCase().replace(/-/g, "_");
}

function readPositiveInteger(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function getWorkerOptions(
  queueName: QueueName,
  env: NodeJS.ProcessEnv = process.env
): Pick<WorkerOptions, "concurrency" | "limiter"> {
  const suffix = toEnvSuffix(queueName);
  const concurrency =
    readPositiveInteger(env[`CRAWLER_WORKER_${suffix}_CONCURRENCY`]) ?? defaultWorkerConcurrency[queueName];
  const rateLimitMax = readPositiveInteger(env[`CRAWLER_WORKER_${suffix}_RATE_LIMIT_MAX`]);
  const rateLimitDuration = readPositiveInteger(env[`CRAWLER_WORKER_${suffix}_RATE_LIMIT_DURATION_MS`]);

  return {
    concurrency,
    ...(rateLimitMax && rateLimitDuration
      ? {
          limiter: {
            max: rateLimitMax,
            duration: rateLimitDuration
          }
        }
      : {})
  };
}
