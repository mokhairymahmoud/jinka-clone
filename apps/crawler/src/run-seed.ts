import { randomUUID } from "node:crypto";

import { PrismaClient, ListingSource as PrismaListingSource } from "@prisma/client";

import type { ListingSource } from "@jinka-eg/types";
import { PropertyFinderConnector } from "./connectors/property-finder.connector.js";
import { AqarmapConnector } from "./connectors/aqarmap.connector.js";
import { FacebookConnector } from "./connectors/facebook.connector.js";
import { NawyConnector } from "./connectors/nawy.connector.js";
import type { SourceConnector } from "./core/connector.js";
import { IngestionPipeline } from "./core/ingestion-pipeline.js";
import { closeQueues, createQueues, createRedisConnection } from "./core/queue.js";
import { closeWorkers, createWorkers } from "./core/workers.js";

const connectors: Record<ListingSource, SourceConnector> = {
  nawy: new NawyConnector(),
  property_finder: new PropertyFinderConnector(),
  aqarmap: new AqarmapConnector(),
  facebook: new FacebookConnector()
};

function parseArg(argv: string[], name: string) {
  const prefix = `--${name}=`;
  const value = argv.find((entry) => entry.startsWith(prefix));
  return value ? value.slice(prefix.length) : undefined;
}

function parseSource(value: string | undefined): ListingSource {
  if (value === "nawy" || value === "property_finder" || value === "aqarmap" || value === "facebook") {
    return value;
  }

  throw new Error("Missing or invalid --source. Expected one of: nawy, property_finder, aqarmap, facebook");
}

function toPrismaSource(source: ListingSource) {
  switch (source) {
    case "nawy":
      return PrismaListingSource.NAWY;
    case "property_finder":
      return PrismaListingSource.PROPERTY_FINDER;
    case "aqarmap":
      return PrismaListingSource.AQARMAP;
    case "facebook":
      return PrismaListingSource.FACEBOOK;
  }
}

async function waitForRun(prisma: PrismaClient, runId: string, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const run = await prisma.ingestionRun.findUnique({
      where: { id: runId }
    });

    if (run && ["completed", "failed", "skipped"].includes(run.status)) {
      return run;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for run ${runId}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const source = parseSource(parseArg(argv, "source"));
  const seedLabel = parseArg(argv, "seed");
  const timeoutMs = Number(parseArg(argv, "timeout-ms") ?? "300000");

  if (!seedLabel) {
    throw new Error("Missing --seed=<seed-label>");
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Invalid --timeout-ms value");
  }

  const connector = connectors[source];
  const seeds = await connector.discover();
  const seed = seeds.find((entry) => entry.label === seedLabel);

  if (!seed) {
    throw new Error(`Seed not found for ${source}: ${seedLabel}`);
  }

  const prisma = new PrismaClient();
  const queues = createQueues(createRedisConnection());
  const pipeline = new IngestionPipeline(queues);
  const workers = createWorkers(pipeline);

  try {
    const run = await prisma.ingestionRun.create({
      data: {
        source: toPrismaSource(source),
        status: "running"
      }
    });

    await queues["discover-page"].add(`discover:${source}:${run.id}:${seed.label}`, {
      source,
      runId: run.id,
      seed: {
        ...seed,
        source,
        seedKind: "discovery",
        page: seed.page ?? 1,
        sweepToken: randomUUID()
      }
    });

    const finalRun = await waitForRun(prisma, run.id, timeoutMs);

    console.log(
      JSON.stringify(
        {
          runId: finalRun.id,
          status: finalRun.status,
          discoveredCount: finalRun.discoveredCount,
          parsedCount: finalRun.parsedCount,
          failedCount: finalRun.failedCount,
          extractionRate: finalRun.extractionRate,
          seed: {
            label: seed.label,
            url: seed.url
          }
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
    await closeWorkers(workers);
    await closeQueues(queues);
    await pipeline.close();
  }
}

void main();
