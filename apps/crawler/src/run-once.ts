import { PrismaClient } from "@prisma/client";

import type { ListingSource } from "@jinka-eg/types";
import { closeQueues, createQueues, createRedisConnection } from "./core/queue.js";
import { IngestionPipeline } from "./core/ingestion-pipeline.js";
import { closeWorkers, createWorkers } from "./core/workers.js";

function parseSources(argv: string[]): ListingSource[] {
  const passed = argv
    .flatMap((arg) => (arg.startsWith("--source=") ? [arg.replace("--source=", "")] : []))
    .filter((source): source is ListingSource =>
      ["nawy", "property_finder", "aqarmap", "facebook"].includes(source)
    );

  return passed.length > 0 ? passed : ["nawy", "property_finder"];
}

async function waitForRuns(prisma: PrismaClient, sources: ListingSource[], since: Date) {
  const prismaSources = {
    nawy: "NAWY",
    property_finder: "PROPERTY_FINDER",
    aqarmap: "AQARMAP",
    facebook: "FACEBOOK"
  } as const;

  const deadline = Date.now() + 60000;

  while (Date.now() < deadline) {
    const runs = await prisma.ingestionRun.findMany({
      where: {
        source: {
          in: sources.map((source) => prismaSources[source])
        },
        startedAt: {
          gte: since
        }
      },
      orderBy: {
        startedAt: "desc"
      }
    });

    const latestBySource = new Map<string, (typeof runs)[number]>();

    for (const run of runs) {
      if (!latestBySource.has(run.source)) {
        latestBySource.set(run.source, run);
      }
    }

    if (
      sources.every((source) => latestBySource.has(prismaSources[source])) &&
      [...latestBySource.values()].every((run) => ["completed", "failed"].includes(run.status))
    ) {
      return [...latestBySource.values()];
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Timed out waiting for ingestion runs to complete");
}

async function main() {
  const sources = parseSources(process.argv.slice(2));
  const redis = createRedisConnection();
  const queues = createQueues(redis);
  const pipeline = new IngestionPipeline(queues);
  const prisma = new PrismaClient();
  const startedAt = new Date();
  const workers = createWorkers(pipeline);

  await pipeline.enqueueSources(sources);
  const runs = await waitForRuns(prisma, sources, new Date(startedAt.getTime() - 1000));

  console.log(
    JSON.stringify(
      runs.map((run) => ({
        source: run.source,
        status: run.status,
        discoveredCount: run.discoveredCount,
        parsedCount: run.parsedCount,
        failedCount: run.failedCount,
        extractionRate: run.extractionRate
      })),
      null,
      2
    )
  );

  await prisma.$disconnect();
  await closeWorkers(workers);
  await closeQueues(queues);
  await pipeline.close();
}

void main();
