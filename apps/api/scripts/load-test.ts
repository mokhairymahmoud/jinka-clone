import { performance } from "node:perf_hooks";

function getArg(name: string, fallback: string) {
  const value = process.argv.find((entry) => entry.startsWith(`--${name}=`))?.split("=")[1];
  return value ?? fallback;
}

async function authenticate(baseUrl: string, email: string) {
  const requestOtp = await fetch(`${baseUrl}/auth/email/request-otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email })
  });
  const otp = (await requestOtp.json()) as { otpPreview?: string };

  if (!otp.otpPreview) {
    throw new Error("OTP preview not available for load test authentication");
  }

  const verify = await fetch(`${baseUrl}/auth/email/verify-otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code: otp.otpPreview })
  });
  const auth = (await verify.json()) as { accessToken?: string };

  if (!auth.accessToken) {
    throw new Error("Access token not returned during load test authentication");
  }

  return auth.accessToken;
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return Number(sorted[index].toFixed(2));
}

async function main() {
  const baseUrl = getArg("base", "http://localhost:4001/v1");
  const totalRequests = Number(getArg("requests", "40"));
  const concurrency = Number(getArg("concurrency", "8"));
  const email = getArg("email", "demo@example.com");
  const accessToken = await authenticate(baseUrl, email);
  const durations: number[] = [];
  const statuses = new Map<number, number>();
  let failures = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < totalRequests) {
      const current = cursor;
      cursor += 1;
      const started = performance.now();

      try {
        const response = await fetch(`${baseUrl}/listings`, {
          headers: {
            authorization: `Bearer ${accessToken}`
          }
        });
        const duration = performance.now() - started;
        durations[current] = duration;
        statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);

        if (!response.ok) {
          failures += 1;
        } else {
          await response.json();
        }
      } catch {
        failures += 1;
      }
    }
  }

  const startedAt = performance.now();
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
  const totalDuration = performance.now() - startedAt;
  const completedDurations = durations.filter((value): value is number => Number.isFinite(value));
  const average =
    completedDurations.length > 0
      ? Number((completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length).toFixed(2))
      : 0;

  console.log(
    JSON.stringify(
      {
        baseUrl,
        totalRequests,
        concurrency,
        successes: completedDurations.length - failures,
        failures,
        totalDurationMs: Number(totalDuration.toFixed(2)),
        averageLatencyMs: average,
        p95LatencyMs: percentile(completedDurations, 0.95),
        p99LatencyMs: percentile(completedDurations, 0.99),
        statusCounts: Object.fromEntries(statuses)
      },
      null,
      2
    )
  );
}

void main();
