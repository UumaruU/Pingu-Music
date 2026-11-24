import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Database,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  AdminListResponse,
  DiscoveryJob,
  DiscoveryJobDetailResponse,
  ProviderResultLog,
  RecommendationCandidateSnapshot,
  RecommendationCandidatesResponse,
  RecommendationFilteredResponse,
  RecommendationFilterLog,
  RecommendationFunnel,
  RecommendationRequestAudit,
  RecommendationRequestTrace,
  RecommendationScoreBreakdown,
  UserPoolHealthResponse,
  UserRecommendationProfileResponse,
} from "../services/adminObservatoryClient";
import { adminObservatoryService } from "../services/adminObservatoryService";
import { adminTokenService } from "../services/adminTokenService";
import { AdminSectionId, RouteState } from "../types";

type LoadStatus = "idle" | "loading" | "ready" | "error";

interface AdminObservatoryPageProps {
  route: RouteState;
  onNavigateSection: (section: AdminSectionId) => void;
  onOpenRequest: (requestId: string | null) => void;
  onOpenDiscoveryJob: (jobId: string | null) => void;
  onOpenUser: (userId: string) => void;
}

interface RequestDetailBundle {
  trace: RecommendationRequestTrace;
  funnel: RecommendationFunnel;
  candidates: RecommendationCandidatesResponse;
  filtered: RecommendationFilteredResponse;
}

interface ProfileBundle {
  profile: UserRecommendationProfileResponse;
  poolHealth: UserPoolHealthResponse;
}

interface TableColumn<T> {
  key: string;
  label: string;
  className?: string;
  render: (item: T) => ReactNode;
}

const scoreComponentKeys = [
  ["userTasteSimilarity", "Taste"],
  ["graphSimilarity", "Graph"],
  ["tagMatch", "Tags"],
  ["playlistCooccurrence", "Playlist"],
  ["novelty", "Novelty"],
  ["freshness", "Freshness"],
  ["sourceQuality", "Source"],
  ["cooldownPenalty", "Cooldown"],
  ["exposureFatigue", "Fatigue"],
  ["diversityPenalty", "Diversity"],
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readNumber(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatNumber(value: number | null | undefined, digits = 3) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(digits);
}

function formatCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function summarize(value: unknown, maxLength = 120) {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "string") {
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  const text = JSON.stringify(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function entryList(value: Record<string, number> | undefined) {
  return Object.entries(value ?? {}).sort((left, right) => right[1] - left[1]);
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[360px] overflow-auto rounded-[18px] border border-white/[0.06] bg-black/24 p-4 text-xs leading-5 text-white/62">
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  );
}

function StatusMessage({
  status,
  error,
  empty,
}: {
  status: LoadStatus;
  error: string | null;
  empty?: string;
}) {
  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-[18px] border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-sm text-white/55">
        <RefreshCw size={15} className="animate-spin" />
        Loading
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-2 rounded-[18px] border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-50/85">
        <AlertCircle size={15} />
        {error ?? "Request failed"}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="rounded-[18px] border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-5 text-sm text-white/42">
        {empty}
      </div>
    );
  }

  return null;
}

function MetricTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "good" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "text-[var(--im-green)]"
      : tone === "warn"
        ? "text-amber-200"
        : "text-white";

  return (
    <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.025] p-4">
      <div className="text-[11px] uppercase text-white/35">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function DataTable<T>({
  rows,
  columns,
  emptyLabel = "No rows",
}: {
  rows: T[];
  columns: Array<TableColumn<T>>;
  emptyLabel?: string;
}) {
  if (!rows.length) {
    return <StatusMessage status="ready" error={null} empty={emptyLabel} />;
  }

  return (
    <div className="overflow-x-auto rounded-[18px] border border-white/[0.06] bg-black/18">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-white/[0.06] bg-white/[0.025] text-[11px] uppercase text-white/35">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`px-3 py-3 font-semibold ${column.className ?? ""}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.045]">
          {rows.map((row, index) => (
            <tr key={index} className="text-white/66 hover:bg-white/[0.025]">
              {columns.map((column) => (
                <td key={column.key} className={`max-w-[280px] px-3 py-3 align-top ${column.className ?? ""}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {action}
    </div>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inspires-focus-ring inline-flex items-center justify-center gap-2 rounded-[16px] border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "border-white bg-white text-black"
          : "border-white/[0.08] bg-white/[0.035] text-white/68 hover:bg-white/[0.07] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function TokenBar({
  token,
  onTokenChange,
}: {
  token: string;
  onTokenChange: (value: string) => void;
}) {
  return (
    <div className="inspires-panel rounded-[24px] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white text-black">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Recommendation Observatory</div>
            <div className="mt-1 text-xs text-white/40">Internal admin</div>
          </div>
        </div>
        <label className="min-w-0 flex-1 lg:ml-auto">
          <span className="sr-only">Admin token</span>
          <input
            type="password"
            value={token}
            onChange={(event) => onTokenChange(event.target.value)}
            placeholder="X-Admin-Token"
            className="inspires-focus-ring w-full rounded-[16px] border border-white/[0.08] bg-black/24 px-4 py-3 text-sm text-white outline-none placeholder:text-white/28"
          />
        </label>
      </div>
    </div>
  );
}

function RequestList({
  requests,
  status,
  error,
  onRefresh,
  onOpenRequest,
}: {
  requests: AdminListResponse<RecommendationRequestAudit> | null;
  status: LoadStatus;
  error: string | null;
  onRefresh: () => void;
  onOpenRequest: (requestId: string) => void;
}) {
  return (
    <section className="inspires-panel rounded-[24px] p-4">
      <SectionHeader
        title="Recommendation Request Trace"
        action={
          <IconButton onClick={onRefresh} disabled={status === "loading"}>
            <RefreshCw size={15} />
            Refresh
          </IconButton>
        }
      />
      <StatusMessage status={status} error={error} />
      {status !== "loading" && status !== "error" ? (
        <DataTable
          rows={requests?.items ?? []}
          emptyLabel="No recommendation requests"
          columns={[
            {
              key: "id",
              label: "Request",
              render: (request) => (
                <button
                  type="button"
                  onClick={() => onOpenRequest(request.id)}
                  className="inspires-focus-ring max-w-[220px] truncate rounded-[12px] px-1 text-left font-mono text-xs text-cyan-200 hover:text-white"
                >
                  {request.id}
                </button>
              ),
            },
            { key: "user", label: "User", render: (request) => <span className="font-mono text-xs">{request.userId}</span> },
            { key: "surface", label: "Surface", render: (request) => request.surface },
            { key: "strategy", label: "Strategy", render: (request) => request.strategy ?? "-" },
            { key: "status", label: "Status", render: (request) => request.status },
            { key: "created", label: "Created", render: (request) => formatDate(request.createdAt) },
            {
              key: "summary",
              label: "Generators",
              render: (request) => (
                <span className="line-clamp-2 text-xs text-white/48">
                  {summarize(request.candidateGeneratorSummary)}
                </span>
              ),
            },
          ]}
        />
      ) : null}
    </section>
  );
}

function FunnelPanel({ funnel }: { funnel: RecommendationFunnel }) {
  const removedReasons = entryList(funnel.filteredCandidateCountByReason);
  const sourceCounts = entryList(funnel.generatedCandidateCountBySource);

  return (
    <section className="inspires-panel rounded-[24px] p-4">
      <SectionHeader title="Candidate Funnel" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Generated" value={formatCount(funnel.generatedCandidateCount)} />
        <MetricTile label="Filtered" value={formatCount(funnel.filteredCandidateCount)} tone="warn" />
        <MetricTile label="Remaining" value={formatCount(funnel.remainingCandidateCount)} />
        <MetricTile label="Final" value={formatCount(funnel.finalReturnedTrackCount)} tone="good" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DataTable
          rows={sourceCounts}
          emptyLabel="No generator sources"
          columns={[
            { key: "source", label: "Source", render: ([source]) => source },
            { key: "count", label: "Count", render: ([, count]) => formatCount(count) },
          ]}
        />
        <DataTable
          rows={removedReasons}
          emptyLabel="No filtered candidates"
          columns={[
            { key: "reason", label: "Filter reason", render: ([reason]) => reason },
            { key: "count", label: "Count", render: ([, count]) => formatCount(count) },
          ]}
        />
      </div>
    </section>
  );
}

function ScoreBreakdownTable({
  scoreBreakdowns,
}: {
  scoreBreakdowns: RecommendationScoreBreakdown[];
}) {
  return (
    <section className="inspires-panel rounded-[24px] p-4">
      <SectionHeader title="Candidate Score Breakdown" />
      <DataTable
        rows={scoreBreakdowns}
        emptyLabel="No score breakdowns"
        columns={[
          { key: "rank", label: "Rank", render: (score) => score.rank ?? "-" },
          {
            key: "track",
            label: "Candidate",
            render: (score) => <span className="font-mono text-xs">{score.canonicalTrackId ?? "-"}</span>,
          },
          {
            key: "final",
            label: "Final",
            render: (score) => <span className="font-semibold text-white">{formatNumber(score.finalScore)}</span>,
          },
          ...scoreComponentKeys.map<TableColumn<RecommendationScoreBreakdown>>(([key, label]) => ({
            key,
            label,
            render: (score) => {
              const components = asRecord(score.components);
              const penalties = asRecord(score.penalties);
              const source = key.endsWith("Penalty") || key === "exposureFatigue" ? penalties : components;
              return formatNumber(readNumber(source, key));
            },
          })),
        ]}
      />
    </section>
  );
}

function CandidateTable({
  candidates,
}: {
  candidates: RecommendationCandidateSnapshot[];
}) {
  return (
    <section className="inspires-panel rounded-[24px] p-4">
      <SectionHeader title="Candidates" />
      <DataTable
        rows={candidates}
        emptyLabel="No candidates"
        columns={[
          { key: "stage", label: "Stage", render: (candidate) => candidate.stage },
          { key: "rank", label: "Rank", render: (candidate) => candidate.rank ?? "-" },
          {
            key: "track",
            label: "Candidate",
            render: (candidate) => <span className="font-mono text-xs">{candidate.canonicalTrackId ?? "-"}</span>,
          },
          { key: "score", label: "Score", render: (candidate) => formatNumber(candidate.score) },
          {
            key: "sources",
            label: "Source",
            render: (candidate) => (candidate.sourceChannels ?? []).join(", ") || "-",
          },
          {
            key: "reason",
            label: "Reason",
            render: (candidate) => (
              <span className="line-clamp-2 text-xs text-white/48">
                {summarize(candidate.reasonSummary)}
              </span>
            ),
          },
        ]}
      />
    </section>
  );
}

function FilteredTable({
  filtered,
}: {
  filtered: RecommendationFilteredResponse;
}) {
  return (
    <section className="inspires-panel rounded-[24px] p-4">
      <SectionHeader title="Filtered Candidates" />
      <DataTable
        rows={filtered.items}
        emptyLabel="No filtered candidates"
        columns={[
          {
            key: "track",
            label: "Candidate",
            render: (item: RecommendationFilterLog) => <span className="font-mono text-xs">{item.canonicalTrackId ?? "-"}</span>,
          },
          { key: "stage", label: "Stage", render: (item) => item.stage },
          { key: "reason", label: "Reason", render: (item) => item.reason },
          { key: "score", label: "Score", render: (item) => formatNumber(item.score) },
          {
            key: "details",
            label: "Details",
            render: (item) => <span className="line-clamp-2 text-xs text-white/48">{summarize(item.details)}</span>,
          },
        ]}
      />
    </section>
  );
}

function ProviderResultViewer({
  providerLogs,
}: {
  providerLogs: ProviderResultLog[];
}) {
  return (
    <section className="inspires-panel rounded-[24px] p-4">
      <SectionHeader title="Provider Result Viewer" />
      <DataTable
        rows={providerLogs}
        emptyLabel="No provider result logs"
        columns={[
          { key: "provider", label: "Provider", render: (item) => item.providerId },
          { key: "operation", label: "Operation", render: (item) => item.operation ?? "-" },
          { key: "status", label: "Status", render: (item) => item.status },
          { key: "entity", label: "Entity", render: (item) => `${item.entityType ?? "-"}:${item.entityId ?? "-"}` },
          { key: "bytes", label: "Raw bytes", render: (item) => formatCount(item.rawPayloadBytes ?? 0) },
          { key: "ttl", label: "Raw TTL", render: (item) => formatDate(item.rawPayloadExpiresAt) },
        ]}
      />
    </section>
  );
}

function RequestTraceDetail({
  detail,
  status,
  error,
  onBack,
}: {
  detail: RequestDetailBundle | null;
  status: LoadStatus;
  error: string | null;
  onBack: () => void;
}) {
  if (status === "loading" || status === "error" || !detail) {
    return (
      <section className="inspires-panel rounded-[24px] p-4">
        <div className="mb-4">
          <IconButton onClick={onBack}>
            <ArrowLeft size={15} />
            Requests
          </IconButton>
        </div>
        <StatusMessage
          status={status}
          error={error}
          empty={status === "idle" ? "Select a request" : undefined}
        />
      </section>
    );
  }

  const request = detail.trace.request;

  return (
    <div className="space-y-4">
      <section className="inspires-panel rounded-[24px] p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <IconButton onClick={onBack}>
            <ArrowLeft size={15} />
            Requests
          </IconButton>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-xs text-white/50">
            {request.status}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Surface" value={request.surface} />
          <MetricTile label="Mode" value={request.mode ?? "-"} />
          <MetricTile label="Strategy" value={request.strategy ?? "-"} />
          <MetricTile label="Created" value={formatDate(request.createdAt)} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-sm font-semibold text-white">User Profile Snapshot</div>
            <JsonBlock value={request.userProfileSnapshot} />
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold text-white">Seeds and Expansion</div>
            <JsonBlock
              value={{
                seed: request.seed,
                candidateGeneratorSummary: request.candidateGeneratorSummary,
                poolHealthSnapshot: request.poolHealthSnapshot,
                expansionSummary: request.expansionSummary,
                finalRecommendations: request.finalRecommendations,
              }}
            />
          </div>
        </div>
      </section>

      <FunnelPanel funnel={detail.funnel} />
      <ScoreBreakdownTable scoreBreakdowns={detail.candidates.scoreBreakdowns} />
      <FilteredTable filtered={detail.filtered} />
      <CandidateTable candidates={detail.candidates.candidates} />
      <ProviderResultViewer providerLogs={detail.trace.providerResultLogs} />
    </div>
  );
}

function ProfilePanel({
  userId,
  onUserIdChange,
  profile,
  status,
  error,
  onLoad,
}: {
  userId: string;
  onUserIdChange: (value: string) => void;
  profile: ProfileBundle | null;
  status: LoadStatus;
  error: string | null;
  onLoad: () => void;
}) {
  return (
    <section className="inspires-panel rounded-[24px] p-4">
      <SectionHeader title="User Taste Profile" />
      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">User ID</span>
          <input
            value={userId}
            onChange={(event) => onUserIdChange(event.target.value)}
            placeholder="user id"
            className="inspires-focus-ring w-full rounded-[16px] border border-white/[0.08] bg-black/24 px-4 py-3 text-sm text-white outline-none placeholder:text-white/28"
          />
        </label>
        <IconButton onClick={onLoad} disabled={!userId.trim() || status === "loading"}>
          <Search size={15} />
          Load
        </IconButton>
      </div>
      <StatusMessage status={status} error={error} empty={profile ? undefined : "No profile loaded"} />
      {profile ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div>
            <div className="mb-2 text-sm font-semibold text-white">Profile</div>
            <JsonBlock value={profile.profile.profile} />
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold text-white">Pool Health</div>
            <JsonBlock value={profile.poolHealth.latest ?? profile.poolHealth.items} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DiscoveryPanel({
  jobs,
  jobDetail,
  status,
  detailStatus,
  error,
  detailError,
  onRefresh,
  onOpenJob,
}: {
  jobs: AdminListResponse<DiscoveryJob> | null;
  jobDetail: DiscoveryJobDetailResponse | null;
  status: LoadStatus;
  detailStatus: LoadStatus;
  error: string | null;
  detailError: string | null;
  onRefresh: () => void;
  onOpenJob: (jobId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <section className="inspires-panel rounded-[24px] p-4">
        <SectionHeader
          title="Discovery Job Monitor"
          action={
            <IconButton onClick={onRefresh} disabled={status === "loading"}>
              <RefreshCw size={15} />
              Refresh
            </IconButton>
          }
        />
        <StatusMessage status={status} error={error} />
        {status !== "loading" && status !== "error" ? (
          <DataTable
            rows={jobs?.items ?? []}
            emptyLabel="No discovery jobs"
            columns={[
              {
                key: "id",
                label: "Job",
                render: (job) => (
                  <button
                    type="button"
                    onClick={() => onOpenJob(job.id)}
                    className="inspires-focus-ring max-w-[220px] truncate rounded-[12px] px-1 text-left font-mono text-xs text-cyan-200 hover:text-white"
                  >
                    {job.id}
                  </button>
                ),
              },
              { key: "type", label: "Type", render: (job) => job.jobType },
              { key: "status", label: "Status", render: (job) => job.status },
              { key: "provider", label: "Provider", render: (job) => job.providerId ?? "-" },
              { key: "priority", label: "Priority", render: (job) => job.priority },
              { key: "attempts", label: "Attempts", render: (job) => `${job.attempts}/${job.maxAttempts}` },
              { key: "runAfter", label: "Run after", render: (job) => formatDate(job.runAfter) },
            ]}
          />
        ) : null}
      </section>

      <section className="inspires-panel rounded-[24px] p-4">
        <SectionHeader title="Discovery Job Detail" />
        <StatusMessage
          status={detailStatus}
          error={detailError}
          empty={jobDetail ? undefined : "No discovery job selected"}
        />
        {jobDetail ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-semibold text-white">Job</div>
              <JsonBlock value={jobDetail.job} />
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-white">Logs</div>
              <JsonBlock value={jobDetail.logs} />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function AdminObservatoryPage({
  route,
  onNavigateSection,
  onOpenRequest,
  onOpenDiscoveryJob,
  onOpenUser,
}: AdminObservatoryPageProps) {
  const section = route.adminSection ?? "recommendations";
  const [adminToken, setAdminToken] = useState(() => adminTokenService.getToken() ?? "");
  const [requests, setRequests] = useState<AdminListResponse<RecommendationRequestAudit> | null>(null);
  const [requestsStatus, setRequestsStatus] = useState<LoadStatus>("idle");
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RequestDetailBundle | null>(null);
  const [detailStatus, setDetailStatus] = useState<LoadStatus>("idle");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [userId, setUserId] = useState(route.adminUserId ?? "");
  const [profile, setProfile] = useState<ProfileBundle | null>(null);
  const [profileStatus, setProfileStatus] = useState<LoadStatus>("idle");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<AdminListResponse<DiscoveryJob> | null>(null);
  const [jobsStatus, setJobsStatus] = useState<LoadStatus>("idle");
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<DiscoveryJobDetailResponse | null>(null);
  const [jobDetailStatus, setJobDetailStatus] = useState<LoadStatus>("idle");
  const [jobDetailError, setJobDetailError] = useState<string | null>(null);
  const tokenReady = adminToken.trim().length > 0;

  const handleTokenChange = useCallback((value: string) => {
    setAdminToken(value);
    adminTokenService.setToken(value);
  }, []);

  const loadRequests = useCallback(() => {
    if (!tokenReady) {
      setRequestsStatus("idle");
      setRequestsError(null);
      return;
    }

    setRequestsStatus("loading");
    setRequestsError(null);
    void adminObservatoryService
      .listRecommendationRequests({ limit: 50 })
      .then((items) => {
        setRequests(items);
        setRequestsStatus("ready");
      })
      .catch((error) => {
        setRequestsStatus("error");
        setRequestsError(error instanceof Error ? error.message : "Failed to load requests");
      });
  }, [tokenReady]);

  const loadRequestDetail = useCallback((requestId: string) => {
    if (!tokenReady) {
      setDetailStatus("idle");
      setDetail(null);
      return;
    }

    setDetailStatus("loading");
    setDetailError(null);
    void Promise.all([
      adminObservatoryService.getRecommendationRequest(requestId),
      adminObservatoryService.getRecommendationFunnel(requestId),
      adminObservatoryService.getRecommendationCandidates(requestId),
      adminObservatoryService.getRecommendationFiltered(requestId),
    ])
      .then(([trace, funnel, candidates, filtered]) => {
        setDetail({ trace, funnel, candidates, filtered });
        setDetailStatus("ready");
      })
      .catch((error) => {
        setDetailStatus("error");
        setDetailError(error instanceof Error ? error.message : "Failed to load request detail");
      });
  }, [tokenReady]);

  const loadProfile = useCallback(() => {
    const normalizedUserId = userId.trim();
    if (!tokenReady || !normalizedUserId) {
      setProfileStatus("idle");
      return;
    }

    setProfileStatus("loading");
    setProfileError(null);
    void Promise.all([
      adminObservatoryService.getUserRecommendationProfile(normalizedUserId),
      adminObservatoryService.getUserPoolHealth(normalizedUserId, { limit: 20 }),
    ])
      .then(([profileResponse, poolHealth]) => {
        setProfile({ profile: profileResponse, poolHealth });
        setProfileStatus("ready");
        onOpenUser(normalizedUserId);
      })
      .catch((error) => {
        setProfileStatus("error");
        setProfileError(error instanceof Error ? error.message : "Failed to load profile");
      });
  }, [onOpenUser, tokenReady, userId]);

  const loadJobs = useCallback(() => {
    if (!tokenReady) {
      setJobsStatus("idle");
      return;
    }

    setJobsStatus("loading");
    setJobsError(null);
    void adminObservatoryService
      .listDiscoveryJobs({ limit: 50 })
      .then((items) => {
        setJobs(items);
        setJobsStatus("ready");
      })
      .catch((error) => {
        setJobsStatus("error");
        setJobsError(error instanceof Error ? error.message : "Failed to load discovery jobs");
      });
  }, [tokenReady]);

  const loadJobDetail = useCallback((jobId: string) => {
    if (!tokenReady) {
      setJobDetailStatus("idle");
      setJobDetail(null);
      return;
    }

    setJobDetailStatus("loading");
    setJobDetailError(null);
    void adminObservatoryService
      .getDiscoveryJob(jobId)
      .then((response) => {
        setJobDetail(response);
        setJobDetailStatus("ready");
      })
      .catch((error) => {
        setJobDetailStatus("error");
        setJobDetailError(error instanceof Error ? error.message : "Failed to load discovery job");
      });
  }, [tokenReady]);

  useEffect(() => {
    if (section === "recommendations") {
      loadRequests();
    }
  }, [loadRequests, section]);

  useEffect(() => {
    if (section !== "recommendations" || !route.adminRequestId) {
      setDetail(null);
      setDetailStatus("idle");
      return;
    }

    loadRequestDetail(route.adminRequestId);
  }, [loadRequestDetail, route.adminRequestId, section]);

  useEffect(() => {
    if (route.adminUserId) {
      setUserId(route.adminUserId);
    }
  }, [route.adminUserId]);

  useEffect(() => {
    if (section === "discovery") {
      loadJobs();
    }
  }, [loadJobs, section]);

  useEffect(() => {
    if (section !== "discovery" || !route.adminJobId) {
      setJobDetail(null);
      setJobDetailStatus("idle");
      return;
    }

    loadJobDetail(route.adminJobId);
  }, [loadJobDetail, route.adminJobId, section]);

  const requestCount = requests?.pagination?.total ?? requests?.items.length ?? 0;
  const latestRequest = requests?.items[0] ?? null;
  const headerMetrics = useMemo(
    () => [
      { label: "Requests", value: formatCount(requestCount) },
      { label: "Latest", value: latestRequest ? formatDate(latestRequest.createdAt) : "-" },
      { label: "Jobs", value: formatCount(jobs?.pagination?.total ?? jobs?.items.length ?? 0) },
    ],
    [jobs?.items.length, jobs?.pagination?.total, latestRequest, requestCount],
  );

  return (
    <div className="space-y-4">
      <TokenBar token={adminToken} onTokenChange={handleTokenChange} />

      <section className="grid gap-3 md:grid-cols-3">
        {headerMetrics.map((metric) => (
          <MetricTile key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </section>

      <section className="inspires-panel rounded-[24px] p-3">
        <div className="flex flex-wrap gap-2">
          <IconButton
            active={section === "recommendations"}
            onClick={() => onNavigateSection("recommendations")}
          >
            <Activity size={15} />
            Requests
          </IconButton>
          <IconButton active={section === "profile"} onClick={() => onNavigateSection("profile")}>
            <ShieldCheck size={15} />
            User Profile
          </IconButton>
          <IconButton active={section === "discovery"} onClick={() => onNavigateSection("discovery")}>
            <Database size={15} />
            Discovery Jobs
          </IconButton>
        </div>
      </section>

      {!tokenReady ? (
        <StatusMessage status="ready" error={null} empty="Admin token required" />
      ) : null}

      {section === "recommendations" && !route.adminRequestId ? (
        <RequestList
          requests={requests}
          status={requestsStatus}
          error={requestsError}
          onRefresh={loadRequests}
          onOpenRequest={(requestId) => onOpenRequest(requestId)}
        />
      ) : null}

      {section === "recommendations" && route.adminRequestId ? (
        <RequestTraceDetail
          detail={detail}
          status={detailStatus}
          error={detailError}
          onBack={() => onOpenRequest(null)}
        />
      ) : null}

      {section === "profile" ? (
        <ProfilePanel
          userId={userId}
          onUserIdChange={setUserId}
          profile={profile}
          status={profileStatus}
          error={profileError}
          onLoad={loadProfile}
        />
      ) : null}

      {section === "discovery" ? (
        <DiscoveryPanel
          jobs={jobs}
          jobDetail={jobDetail}
          status={jobsStatus}
          detailStatus={jobDetailStatus}
          error={jobsError}
          detailError={jobDetailError}
          onRefresh={loadJobs}
          onOpenJob={(jobId) => {
            onOpenDiscoveryJob(jobId);
            loadJobDetail(jobId);
          }}
        />
      ) : null}
    </div>
  );
}
