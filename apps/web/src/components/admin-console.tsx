"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Card } from "@jinka-eg/ui";

import { apiFetch } from "../lib/api";

type ConnectorHealth = {
  source: string;
  status: "healthy" | "degraded" | "limited";
  parserCoverage: number;
  lastSuccessAt: string | null;
  enabled: boolean;
  disabledReason: string | null;
};

type IngestionRun = {
  id: string;
  source: string;
  status: string;
  discoveredCount: number;
  parsedCount: number;
  failedCount: number;
  extractionRate: number | null;
  startedAt: string;
};

type FraudCase = {
  id: string;
  clusterId: string;
  label: "safe" | "review" | "high_risk";
  score: number;
  explanation: string[] | string;
  resolved: boolean;
  canonicalTitleEn: string;
};

type ClusterEdge = {
  id: string;
  score: number;
  decision: "review" | "auto_attach" | "no_match";
  sourceClusterId: string;
  targetClusterId: string;
  leftVariant: {
    id: string;
    source: string;
    titleEn: string;
    sourceListingId: string;
  };
  rightVariant: {
    id: string;
    source: string;
    titleEn: string;
    sourceListingId: string;
  };
  reasons: Array<{
    code: string;
    message: string;
    weight: number;
  }>;
};

type ReportQueueItem = {
  id: string;
  clusterId: string;
  clusterTitleEn: string;
  reason: string;
  details?: string;
  resolved: boolean;
  resolutionNote?: string;
  reportedBy: string;
  createdAt: string;
};

type BlacklistEntry = {
  id: string;
  source: string;
  matchType: string;
  value: string;
  reason?: string;
  createdAt: string;
  createdBy: string;
};

type ParserDriftAlarm = {
  id: string;
  source: string;
  severity: string;
  message: string;
  resolved: boolean;
  createdAt: string;
  run: {
    id: string;
    extractionRate: number | null;
    failedCount: number;
    parsedCount: number;
  };
};

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message ?? "Request failed");
  }
}

export function AdminConsole({
  connectors,
  runs,
  fraudCases,
  clusterEdges,
  reports,
  blacklists,
  parserDriftAlarms
}: {
  connectors: ConnectorHealth[];
  runs: IngestionRun[];
  fraudCases: FraudCase[];
  clusterEdges: ClusterEdge[];
  reports: ReportQueueItem[];
  blacklists: BlacklistEntry[];
  parserDriftAlarms: ParserDriftAlarm[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [blacklistSource, setBlacklistSource] = useState("facebook");
  const [blacklistMatchType, setBlacklistMatchType] = useState("source_listing_id");
  const [blacklistValue, setBlacklistValue] = useState("");
  const [blacklistReason, setBlacklistReason] = useState("");

  async function runAction(key: string, callback: () => Promise<void>) {
    setSubmitting(key);

    try {
      await callback();
      router.refresh();
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-8">
      <Card className="p-5">
        <div className="text-lg font-semibold text-[var(--jinka-text)]">Create blacklist</div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <select value={blacklistSource} onChange={(event) => setBlacklistSource(event.target.value)} className="border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-3 text-sm text-[var(--jinka-text)]">
            <option value="facebook">facebook</option>
            <option value="aqarmap">aqarmap</option>
            <option value="nawy">nawy</option>
            <option value="property_finder">property_finder</option>
          </select>
          <input value={blacklistMatchType} onChange={(event) => setBlacklistMatchType(event.target.value)} className="border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-3 text-sm text-[var(--jinka-text)]" placeholder="match type" />
          <input value={blacklistValue} onChange={(event) => setBlacklistValue(event.target.value)} className="border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-3 text-sm text-[var(--jinka-text)]" placeholder="value" />
          <input value={blacklistReason} onChange={(event) => setBlacklistReason(event.target.value)} className="border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-3 text-sm text-[var(--jinka-text)]" placeholder="reason" />
        </div>
        <button
          type="button"
          onClick={() =>
            runAction("blacklist", () =>
              postJson("/api/admin/blacklists", {
                source: blacklistSource,
                matchType: blacklistMatchType,
                value: blacklistValue,
                reason: blacklistReason || undefined
              })
            )
          }
          disabled={submitting === "blacklist" || !blacklistValue.trim()}
          className="mt-4 rounded-full bg-[var(--jinka-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Add blacklist
        </button>
      </Card>

      <div className="grid gap-4">
        {connectors.map((connector) => (
          <Card key={connector.source} className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-[var(--jinka-text)]">{connector.source}</div>
                <div className="mt-1 text-sm text-[var(--jinka-muted)]">Parser coverage {Math.round(connector.parserCoverage * 100)}%</div>
                <div className="mt-1 text-xs text-[var(--jinka-muted)]">{connector.lastSuccessAt ? `Last completed ${new Date(connector.lastSuccessAt).toLocaleString()}` : "No runs yet"}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={connector.enabled ? (connector.status === "healthy" ? "success" : "danger") : "accent"}>
                  {connector.enabled ? connector.status : "disabled"}
                </Badge>
                <button
                  type="button"
                  onClick={() =>
                    runAction(`connector:${connector.source}`, async () => {
                      const path = connector.enabled ? "disable" : "enable";
                      const reason = connector.enabled ? window.prompt("Disable reason", connector.disabledReason ?? "Temporarily disabled by ops") : null;
                      await postJson(`/api/admin/connectors/${connector.source}/${path}`, connector.enabled ? { reason } : {});
                    })
                  }
                  disabled={submitting === `connector:${connector.source}`}
                  className="rounded-full border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--jinka-text)]"
                >
                  {connector.enabled ? "Disable" : "Enable"}
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4">
        {runs.map((run) => (
          <Card key={run.id} className="p-5">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-lg font-semibold text-[var(--jinka-text)]">{run.source}</div>
                <div className="mt-1 text-sm text-[var(--jinka-muted)]">discovered {run.discoveredCount} · normalized {run.parsedCount} · failed {run.failedCount}</div>
              </div>
              <Badge tone={run.status === "completed" ? "success" : run.status === "failed" ? "danger" : "accent"}>{run.status}</Badge>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4">
        {fraudCases.map((fraudCase) => (
          <Card key={fraudCase.id} className="p-5">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-lg font-semibold text-[var(--jinka-text)]">{fraudCase.canonicalTitleEn}</div>
                <div className="mt-1 text-sm text-[var(--jinka-muted)]">score {Math.round(fraudCase.score * 100)}% · cluster {fraudCase.clusterId}</div>
                <div className="mt-3 text-sm text-[var(--jinka-muted)]">{Array.isArray(fraudCase.explanation) ? fraudCase.explanation.join(" ") : fraudCase.explanation}</div>
              </div>
              <div className="space-y-2 text-right">
                <Badge tone={fraudCase.label === "safe" ? "success" : "danger"}>{fraudCase.label.replace("_", " ")}</Badge>
                <div className="flex flex-col gap-2">
                  {(["safe", "review", "high_risk"] as const).map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => runAction(`fraud:${fraudCase.id}:${label}`, () => postJson(`/api/admin/fraud-cases/${fraudCase.id}/resolve`, { label }))}
                      disabled={submitting === `fraud:${fraudCase.id}:${label}`}
                      className="rounded-full border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--jinka-text)]"
                    >
                      Mark {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4">
        {parserDriftAlarms.map((alarm) => (
          <Card key={alarm.id} className="p-5">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-lg font-semibold text-[var(--jinka-text)]">{alarm.source}</div>
                <div className="mt-1 text-sm text-[var(--jinka-muted)]">{alarm.message}</div>
              </div>
              <div className="space-y-2 text-right">
                <Badge tone={alarm.resolved ? "success" : alarm.severity === "high" ? "danger" : "accent"}>
                  {alarm.resolved ? "resolved" : alarm.severity}
                </Badge>
                {!alarm.resolved ? (
                  <button
                    type="button"
                    onClick={() => runAction(`parser:${alarm.id}`, () => postJson(`/api/admin/parser-drift-alarms/${alarm.id}/resolve`, {}))}
                    disabled={submitting === `parser:${alarm.id}`}
                    className="rounded-full border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--jinka-text)]"
                  >
                    Resolve
                  </button>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4">
        {clusterEdges.map((edge) => (
          <Card key={edge.id} className="p-5">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-lg font-semibold text-[var(--jinka-text)]">{edge.leftVariant.titleEn} {"->"} {edge.rightVariant.titleEn}</div>
                <div className="mt-1 text-sm text-[var(--jinka-muted)]">cluster {edge.sourceClusterId} candidate for {edge.targetClusterId}</div>
                <div className="mt-3 text-sm text-[var(--jinka-muted)]">{edge.reasons.slice(0, 3).map((reason) => reason.message).join(" ")}</div>
              </div>
              <div className="space-y-2 text-right">
                <Badge tone={edge.decision === "auto_attach" ? "success" : "accent"}>{edge.decision.replace("_", " ")}</Badge>
                <button
                  type="button"
                  onClick={() => runAction(`merge:${edge.id}`, () => postJson(`/api/admin/clusters/${edge.sourceClusterId}/merge`, { targetClusterId: edge.targetClusterId }))}
                  disabled={submitting === `merge:${edge.id}`}
                  className="rounded-full border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--jinka-text)]"
                >
                  Merge
                </button>
                <button
                  type="button"
                  onClick={() =>
                    runAction(`split:${edge.id}`, async () => {
                      const response = await apiFetch(`/v1/listings/${edge.sourceClusterId}/variants`);
                      const variants = (await response.json()) as Array<{ id: string; source: string; title: { en: string } }>;
                      const suggestedIds = variants.map((variant) => `${variant.id}:${variant.source}`).join(", ");
                      const answer = window.prompt(`Variant ids to split from ${edge.sourceClusterId}\n${suggestedIds}`, edge.leftVariant.id);

                      if (!answer) {
                        return;
                      }

                      await postJson(`/api/admin/clusters/${edge.sourceClusterId}/split`, {
                        variantIds: answer.split(",").map((entry) => entry.trim()).filter(Boolean)
                      });
                    })
                  }
                  disabled={submitting === `split:${edge.id}`}
                  className="rounded-full border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--jinka-text)]"
                >
                  Split
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4">
        {reports.map((report) => (
          <Card key={report.id} className="p-5">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-lg font-semibold text-[var(--jinka-text)]">{report.clusterTitleEn}</div>
                <div className="mt-1 text-sm text-[var(--jinka-muted)]">{report.reason} · by {report.reportedBy}</div>
                {report.details ? <div className="mt-3 text-sm text-[var(--jinka-muted)]">{report.details}</div> : null}
              </div>
              <div className="space-y-2 text-right">
                <Badge tone={report.resolved ? "success" : "danger"}>{report.resolved ? "resolved" : "open"}</Badge>
                {!report.resolved ? (
                  <button
                    type="button"
                    onClick={() =>
                      runAction(`report:${report.id}`, async () => {
                        const note = window.prompt("Resolution note", "Handled by operations");
                        if (!note) {
                          return;
                        }
                        await postJson(`/api/admin/reports/${report.id}/resolve`, { resolutionNote: note });
                      })
                    }
                    disabled={submitting === `report:${report.id}`}
                    className="rounded-full border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--jinka-text)]"
                  >
                    Resolve
                  </button>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4">
        {blacklists.map((entry) => (
          <Card key={entry.id} className="p-5">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-lg font-semibold text-[var(--jinka-text)]">{entry.source} · {entry.matchType}</div>
                <div className="mt-1 text-sm text-[var(--jinka-muted)]">{entry.value}</div>
                {entry.reason ? <div className="mt-3 text-sm text-[var(--jinka-muted)]">{entry.reason}</div> : null}
              </div>
              <div className="text-right text-xs text-[var(--jinka-muted)]">
                <div>{entry.createdBy}</div>
                <div className="mt-1">{new Date(entry.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
