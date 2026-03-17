import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Badge } from "@jinka-eg/ui";
import { AdminConsole } from "../../../../components/admin-console";
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

type ParserDriftAlarm = {
  id: string;
  source: string;
  severity: string;
  message: string;
  threshold: number;
  resolved: boolean;
  createdAt: string;
  resolvedAt: string | null;
  run: {
    id: string;
    status: string;
    extractionRate: number | null;
    failedCount: number;
    parsedCount: number;
  };
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
      blacklists: [] as BlacklistEntry[],
      parserDriftAlarms: [] as ParserDriftAlarm[]
    };
  }

  const [connectorsResponse, runsResponse, fraudCasesResponse, clusterEdgesResponse, reportsResponse, blacklistsResponse, parserDriftResponse] =
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
    }),
    apiFetch("/v1/admin/parser-drift-alarms", {
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
    blacklists: blacklistsResponse.ok ? (((await blacklistsResponse.json()) as BlacklistEntry[]) ?? []) : [],
    parserDriftAlarms: parserDriftResponse.ok ? (((await parserDriftResponse.json()) as ParserDriftAlarm[]) ?? []) : []
  };
}

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);
  const user = await requireSessionUser(safeLocale);
  const { connectors, runs, fraudCases, clusterEdges, reports, blacklists, parserDriftAlarms } = await fetchAdminData();

  if (user.role !== "admin" && user.role !== "ops_reviewer") {
    redirect(`/${safeLocale}/account`);
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[28px] border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] p-6">
        <Badge tone="accent">{t.admin}</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--jinka-text)]">{t.adminTitle}</h1>
        <p className="mt-3 max-w-3xl text-[var(--jinka-muted)]">
          Same product language as the customer side, reoriented around ops workflows, risk review, and connector controls.
        </p>
      </div>
      <AdminConsole
        connectors={connectors}
        runs={runs}
        fraudCases={fraudCases}
        clusterEdges={clusterEdges}
        reports={reports}
        blacklists={blacklists}
        parserDriftAlarms={parserDriftAlarms}
      />
    </div>
  );
}
