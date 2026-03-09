import type { ConnectionOptions, Queue } from "bullmq";
import { Queue as BullQueue } from "bullmq";

import { queueNames } from "@jinka-eg/config";

export type QueueName = (typeof queueNames)[number];
export type QueueMap = Record<QueueName, Queue>;

export function createRedisConnection() {
  return {
    url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  } satisfies ConnectionOptions;
}

export function createQueues(connection: ConnectionOptions): QueueMap {
  return Object.fromEntries(
    queueNames.map((queueName) => [
      queueName,
      new BullQueue(queueName, {
        connection,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 100
        }
      })
    ])
  ) as QueueMap;
}

export async function closeQueues(queues: QueueMap) {
  await Promise.all(Object.values(queues).map((queue) => queue.close()));
}
