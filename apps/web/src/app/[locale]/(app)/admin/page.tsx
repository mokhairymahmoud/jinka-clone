import { cookies } from "next/headers";
import { Badge, Card } from "@jinka-eg/ui";
import { redirect } from "next/navigation";

import { apiFetch } from "../../../../lib/api";
import { getMessages, resolveLocale } from "../../../../i18n/messages";
import { requireSessionUser } from "../../../../lib/session";

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
  completedAt: string | null;
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

async function fetchAdminData() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (!accessToken) {
    return {
      connectors: [] as ConnectorHealth[],
      runs: [] as IngestionRun[],
      fraudCases: [] as FraudCase[],
      clusterEdges: [] as ClusterEdge[],
      reports: [] as ReportQueueItem[],
      blacklists: [] as BlacklistEntry[]
    };
  }

  const [connectorsResponse, runsResponse, fraudCasesResponse, clusterEdgesResponse, reportsResponse, blacklistsResponse] =
    await Promise.all([
    apiFetch("/v1/admin/connectors", {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    }),
    apiFetch("/v1/admin/ingestion-runs", {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    }),
    apiFetch("/v1/admin/fraud-cases", {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    }),
    apiFetch("/v1/admin/cluster-edges", {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    }),
    apiFetch("/v1/admin/reports", {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    }),
    apiFetch("/v1/admin/blacklists", {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    })
  ]);

  return {
    connectors: connectorsResponse.ok ? (((await connectorsResponse.json()) as ConnectorHealth[]) ?? []) : [],
    runs: runsResponse.ok ? (((await runsResponse.json()) as IngestionRun[]) ?? []) : [],
    fraudCases: fraudCasesResponse.ok ? (((await fraudCasesResponse.json()) as FraudCase[]) ?? []) : [],
    clusterEdges: clusterEdgesResponse.ok ? (((await clusterEdgesResponse.json()) as ClusterEdge[]) ?? []) : [],
    reports: reportsResponse.ok ? (((await reportsResponse.json()) as ReportQueueItem[]) ?? []) : [],
    blacklists: blacklistsResponse.ok ? (((await blacklistsResponse.json()) as BlacklistEntry[]) ?? []) : []
  };
}

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);
  const user = await requireSessionUser(safeLocale);
  const { connectors, runs, fraudCases, clusterEdges, reports, blacklists } = await fetchAdminData();

  if (user.role !== "admin" && user.role !== "ops_reviewer") {
    redirect(`/${safeLocale}/account`);
  }

  return (
    <div className="space-y-8">
      <div>
        <Badge tone="accent">{t.admin}</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">{t.adminTitle}</h1>
      </div>
      <div className="grid gap-4">
        {connectors.map((connector) => (
          <Card key={connector.source} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-stone-950">{connector.source}</div>
                <div className="mt-1 text-sm text-stone-600">
                  Parser coverage {Math.round(connector.parserCoverage * 100)}%
                </div>
                <div className="mt-1 text-xs text-stone-500">
                  {connector.lastSuccessAt ? `Last completed ${new Date(connector.lastSuccessAt).toLocaleString()}` : "No runs yet"}
                </div>
                {!connector.enabled && connector.disabledReason ? (
                  <div className="mt-1 text-xs text-stone-500">Disabled: {connector.disabledReason}</div>
                ) : null}
              </div>
              <div className="text-right">
                <Badge tone={connector.enabled ? (connector.status === "healthy" ? "success" : "danger") : "accent"}>
                  {connector.enabled ? connector.status : "disabled"}
                </Badge>
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
                <div className="text-lg font-semibold text-stone-950">{run.source}</div>
                <div className="mt-1 text-sm text-stone-600">
                  discovered {run.discoveredCount} · normalized {run.parsedCount} · failed {run.failedCount}
                </div>
                <div className="mt-1 text-xs text-stone-500">
                  started {new Date(run.startedAt).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <Badge tone={run.status === "completed" ? "success" : run.status === "failed" ? "danger" : "accent"}>
                  {run.status}
                </Badge>
                <div className="mt-2 text-sm text-stone-600">
                  {Math.round((run.extractionRate ?? 0) * 100)}% extraction
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div className="grid gap-4">
        {fraudCases.map((fraudCase) => (
          <Card key={fraudCase.id} className="p-5">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-lg font-semibold text-stone-950">{fraudCase.canonicalTitleEn}</div>
                <div className="mt-1 text-sm text-stone-600">
                  score {Math.round(fraudCase.score * 100)}% · cluster {fraudCase.clusterId}
                </div>
                <div className="mt-3 text-sm text-stone-600">
                  {Array.isArray(fraudCase.explanation)
                    ? fraudCase.explanation.join(" ")
                    : fraudCase.explanation}
                </div>
              </div>
              <div className="text-right">
                <Badge tone={fraudCase.label === "safe" ? "success" : "danger"}>
                  {fraudCase.label.replace("_", " ")}
                </Badge>
                <div className="mt-2 text-xs text-stone-500">
                  {fraudCase.resolved ? "resolved" : "open"}
                </div>
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
                <div className="text-lg font-semibold text-stone-950">
                  {edge.leftVariant.titleEn} {"->"} {edge.rightVariant.titleEn}
                </div>
                <div className="mt-1 text-sm text-stone-600">
                  {edge.leftVariant.source} {edge.leftVariant.sourceListingId} {"->"} {edge.rightVariant.source}{" "}
                  {edge.rightVariant.sourceListingId}
                </div>
                <div className="mt-1 text-sm text-stone-600">
                  cluster {edge.sourceClusterId} candidate for {edge.targetClusterId}
                </div>
                <div className="mt-3 text-sm text-stone-600">
                  {edge.reasons.slice(0, 3).map((reason) => reason.message).join(" ")}
                </div>
              </div>
              <div className="text-right">
                <Badge tone={edge.decision === "auto_attach" ? "success" : "accent"}>
                  {edge.decision.replace("_", " ")}
                </Badge>
                <div className="mt-2 text-sm text-stone-600">{Math.round(edge.score * 100)}% confidence</div>
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
                <div className="text-lg font-semibold text-stone-950">{report.clusterTitleEn}</div>
                <div className="mt-1 text-sm text-stone-600">
                  {report.reason} · by {report.reportedBy}
                </div>
                {report.details ? <div className="mt-3 text-sm text-stone-600">{report.details}</div> : null}
                <div className="mt-2 text-xs text-stone-500">{new Date(report.createdAt).toLocaleString()}</div>
              </div>
              <div className="text-right">
                <Badge tone={report.resolved ? "success" : "danger"}>{report.resolved ? "resolved" : "open"}</Badge>
                {report.resolutionNote ? <div className="mt-2 text-xs text-stone-500">{report.resolutionNote}</div> : null}
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
                <div className="text-lg font-semibold text-stone-950">
                  {entry.source} · {entry.matchType}
                </div>
                <div className="mt-1 text-sm text-stone-600">{entry.value}</div>
                {entry.reason ? <div className="mt-3 text-sm text-stone-600">{entry.reason}</div> : null}
              </div>
              <div className="text-right text-xs text-stone-500">
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
