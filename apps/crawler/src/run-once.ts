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

    if (
      sources.every((source) => runs.some((run) => run.source === prismaSources[source])) &&
      runs.every((run) => ["completed", "failed", "skipped"].includes(run.status))
    ) {
      return runs;
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

  const queued = await pipeline.enqueueSources(sources);

  if (queued.queuedSources.length === 0) {
    console.log(
      JSON.stringify(
        {
          requestedSources: sources,
          queuedSources: [],
          skippedSources: queued.skippedSources
        },
        null,
        2
      )
    );
    await prisma.$disconnect();
    await closeWorkers(workers);
    await closeQueues(queues);
    await pipeline.close();
    return;
  }

  const runs = await waitForRuns(prisma, queued.queuedSources, new Date(startedAt.getTime() - 1000));

  const summary = Object.values(
    runs.reduce<Record<string, { source: string; status: string; runs: number; discoveredCount: number; parsedCount: number; failedCount: number; extractionRate: number }>>(
      (acc, run) => {
        const entry =
          acc[run.source] ??
          (acc[run.source] = {
            source: run.source,
            status: run.status,
            runs: 0,
            discoveredCount: 0,
            parsedCount: 0,
            failedCount: 0,
            extractionRate: 0
          });

        entry.runs += 1;
        entry.discoveredCount += run.discoveredCount;
        entry.parsedCount += run.parsedCount;
        entry.failedCount += run.failedCount;
        entry.extractionRate += run.extractionRate ?? 0;
        entry.status = entry.status === "failed" || run.status === "failed" ? "failed" : "completed";
        return acc;
      },
      {}
    )
  ).map((entry) => ({
    ...entry,
    extractionRate: entry.runs === 0 ? 0 : entry.extractionRate / entry.runs
  }));

  console.log(JSON.stringify(summary, null, 2));

  await prisma.$disconnect();
  await closeWorkers(workers);
  await closeQueues(queues);
  await pipeline.close();
}

void main();
