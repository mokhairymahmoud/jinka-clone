import { describe, expect, it } from "vitest";

import { getWorkerOptions } from "./worker-config.js";

describe("getWorkerOptions", () => {
  it("returns higher-throughput defaults for hot crawler queues", () => {
    expect(getWorkerOptions("discover-page", {})).toEqual({
      concurrency: 12
    });
    expect(getWorkerOptions("reconcile-variant", {})).toEqual({
      concurrency: 24
    });
  });

  it("accepts env overrides and optional queue rate limiting", () => {
    expect(
      getWorkerOptions("discover-page", {
        CRAWLER_WORKER_DISCOVER_PAGE_CONCURRENCY: "20",
        CRAWLER_WORKER_DISCOVER_PAGE_RATE_LIMIT_MAX: "40",
        CRAWLER_WORKER_DISCOVER_PAGE_RATE_LIMIT_DURATION_MS: "1000"
      })
    ).toEqual({
      concurrency: 20,
      limiter: {
        max: 40,
        duration: 1000
      }
    });
  });

  it("ignores invalid env overrides", () => {
    expect(
      getWorkerOptions("fetch-detail", {
        CRAWLER_WORKER_FETCH_DETAIL_CONCURRENCY: "0",
        CRAWLER_WORKER_FETCH_DETAIL_RATE_LIMIT_MAX: "-2",
        CRAWLER_WORKER_FETCH_DETAIL_RATE_LIMIT_DURATION_MS: "abc"
      })
    ).toEqual({
      concurrency: 8
    });
  });
});
