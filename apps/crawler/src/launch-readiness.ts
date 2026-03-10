import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

import { listConnectors } from "./core/source-registry.js";
import { createRawSnapshotStorage } from "./core/object-storage.js";

function getArg(name: string, fallback: string) {
  return process.argv.find((entry) => entry.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
}

async function main() {
  const apiBaseUrl = getArg("base", process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/v1` : "http://localhost:4001/v1");
  const prisma = new PrismaClient();
  const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
  const storage = createRawSnapshotStorage();
  const health = await Promise.all(listConnectors().map((connector) => connector.healthcheck()));

  const dbUserCount = await prisma.user.count();
  const redisStatus = await redis.ping();
  await storage.ensureBucket();
  const storageKey = `launch-readiness/${randomUUID()}.txt`;
  await storage.putObject(storageKey, "phase5-launch-readiness", "text/plain");
  const storageEcho = await storage.getObject(storageKey);

  const otpResponse = await fetch(`${apiBaseUrl}/auth/email/request-otp`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ email: "demo@example.com" })
  });
  const otp = (await otpResponse.json()) as { otpPreview?: string };
  const verifyResponse = await fetch(`${apiBaseUrl}/auth/email/verify-otp`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ email: "demo@example.com", code: otp.otpPreview })
  });
  const auth = (await verifyResponse.json()) as { accessToken?: string };
  const listingsResponse = await fetch(`${apiBaseUrl}/listings`, {
    headers: {
      authorization: `Bearer ${auth.accessToken}`
    }
  });
  const projectsResponse = await fetch(`${apiBaseUrl}/projects`);

  console.log(
    JSON.stringify(
      {
        dbUserCount,
        redisStatus,
        storageVerified: storageEcho === "phase5-launch-readiness",
        connectors: health.map((connector) => ({
          source: connector.source,
          status: connector.status,
          parserCoverage: connector.parserCoverage
        })),
        api: {
          otpStatus: otpResponse.status,
          verifyStatus: verifyResponse.status,
          listingsStatus: listingsResponse.status,
          projectsStatus: projectsResponse.status
        }
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
  await redis.quit();
}

void main();
