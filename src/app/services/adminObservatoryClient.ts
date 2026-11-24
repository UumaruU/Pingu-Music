type JsonRecord = Record<string, unknown>;

export interface AdminRequestOptions {
  headers?: Record<string, string>;
  auth?: boolean;
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

export type AdminRequester = <T>(endpoint: string, options: AdminRequestOptions) => Promise<T>;
export type AdminTokenReader = () => string | null;

export interface AdminListQuery {
  limit?: number;
  offset?: number;
  userId?: string;
  status?: string;
}

export interface AdminPagination {
  total: number;
  limit: number;
  offset: number;
}

export interface AdminListResponse<T> {
  items: T[];
  pagination?: AdminPagination;
}

export interface RecommendationRequestAudit {
  id: string;
  userId: string;
  surface: string;
  mode?: string | null;
  strategy?: string | null;
  contextSummary?: string | null;
  seed?: unknown;
  input?: unknown;
  userProfileSnapshot?: unknown;
  userFeatureSnapshot?: unknown;
  contextSnapshot?: unknown;
  poolHealthSnapshot?: unknown;
  candidateGeneratorSummary?: unknown;
  expansionSummary?: unknown;
  finalRecommendations?: unknown;
  sampled?: boolean;
  sampleRate?: number;
  compact?: boolean;
  status: string;
  error?: string | null;
  expiresAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface RecommendationCandidateSnapshot {
  id: string;
  recommendationRequestId: string;
  canonicalTrackId?: string | null;
  preferredVariantId?: string | null;
  stage: string;
  rank?: number | null;
  score?: number | null;
  sourceChannels?: string[];
  sourceSummary?: unknown;
  reasonSummary?: unknown;
  trackSnapshot?: unknown;
  isFinal?: boolean;
  createdAt?: string;
}

export interface RecommendationScoreBreakdown {
  id: string;
  recommendationRequestId: string;
  canonicalTrackId?: string | null;
  rank?: number | null;
  finalScore: number;
  components: unknown;
  penalties?: unknown;
  createdAt?: string;
}

export interface RecommendationFilterLog {
  id: string;
  recommendationRequestId: string;
  canonicalTrackId?: string | null;
  stage: string;
  reason: string;
  score?: number | null;
  details?: unknown;
  createdAt?: string;
}

export interface RecommendationFeatureSnapshot {
  id: string;
  recommendationRequestId: string;
  canonicalTrackId?: string | null;
  entityType: string;
  entityId?: string | null;
  features: unknown;
  createdAt?: string;
}

export interface RecommendationReasonSnapshot {
  id: string;
  recommendationRequestId: string;
  canonicalTrackId?: string | null;
  candidateSnapshotId?: string | null;
  reasonType: string;
  reasons: unknown;
  createdAt?: string;
}

export interface PoolHealthSnapshot {
  id: string;
  recommendationRequestId: string;
  userId?: string | null;
  poolLevel: string;
  health: unknown;
  plan?: unknown;
  queuedJobs?: number | null;
  liveExpansion?: unknown;
  createdAt?: string;
}

export interface DiscoveryJobLog {
  id: string;
  recommendationRequestId?: string | null;
  discoveryJobId?: string | null;
  seedId?: string | null;
  action: string;
  jobType?: string | null;
  status: string;
  providerId?: string | null;
  providerCallCount?: number | null;
  payload?: unknown;
  resultSummary?: unknown;
  rawPayload?: unknown;
  rawPayloadBytes?: number | null;
  rawPayloadExpiresAt?: string | null;
  createdAt?: string;
}

export interface ProviderResultLog {
  id: string;
  recommendationRequestId?: string | null;
  providerId: string;
  operation?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  status: string;
  summary?: unknown;
  rawPayload?: unknown;
  rawPayloadBytes?: number | null;
  rawPayloadExpiresAt?: string | null;
  createdAt?: string;
}

export interface GraphEdgeAudit {
  id: string;
  recommendationRequestId?: string | null;
  candidateTrackId?: string | null;
  sourceNodeType: string;
  sourceNodeId: string;
  targetNodeType: string;
  targetNodeId: string;
  edgeType: string;
  weight?: number | null;
  confidence?: number | null;
  reason?: string | null;
  evidence?: unknown;
  createdAt?: string;
}

export interface RecommendationRequestTrace {
  request: RecommendationRequestAudit;
  candidates: RecommendationCandidateSnapshot[];
  scoreBreakdowns: RecommendationScoreBreakdown[];
  filterLogs: RecommendationFilterLog[];
  featureSnapshots: RecommendationFeatureSnapshot[];
  reasonSnapshots: RecommendationReasonSnapshot[];
  poolHealthSnapshots: PoolHealthSnapshot[];
  discoveryJobLogs: DiscoveryJobLog[];
  providerResultLogs: ProviderResultLog[];
  graphEdges: GraphEdgeAudit[];
}

export interface RecommendationFunnel {
  requestId: string;
  generatedCandidateCount: number;
  generatedCandidateCountBySource: Record<string, number>;
  filteredCandidateCount: number;
  filteredCandidateCountByReason: Record<string, number>;
  remainingCandidateCount: number;
  finalReturnedTrackCount: number;
  finalReturnedTrackIds: string[];
  poolHealth?: PoolHealthSnapshot | null;
}

export interface RecommendationCandidatesResponse {
  requestId: string;
  candidates: RecommendationCandidateSnapshot[];
  scoreBreakdowns: RecommendationScoreBreakdown[];
  featureSnapshots: RecommendationFeatureSnapshot[];
  reasonSnapshots: RecommendationReasonSnapshot[];
}

export interface RecommendationFilteredResponse {
  requestId: string;
  items: RecommendationFilterLog[];
  countByReason: Record<string, number>;
}

export interface UserRecommendationProfileResponse {
  userId: string;
  profile: unknown;
}

export interface UserPoolHealthResponse {
  userId: string;
  latest?: PoolHealthSnapshot | null;
  items: PoolHealthSnapshot[];
}

export interface DiscoveryJob {
  id: string;
  seedId?: string | null;
  jobType: string;
  dedupeKey?: string | null;
  rateLimitKey?: string | null;
  status: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  providerId?: string | null;
  payload: unknown;
  result?: unknown;
  error?: string | null;
  runAfter?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  seed?: JsonRecord | null;
}

export interface DiscoveryJobDetailResponse {
  job: DiscoveryJob;
  logs: DiscoveryJobLog[];
}

function isPresentQueryValue(value: unknown): value is string | number {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return typeof value === "string" && value.trim().length > 0;
}

export function createAdminObservatoryEndpoint(path: string, query: AdminListQuery = {}) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (isPresentQueryValue(value)) {
      params.set(key, String(value).trim());
    }
  });

  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value);
}

function createAdminRequestOptions(readToken: AdminTokenReader): AdminRequestOptions {
  const token = readToken()?.trim();

  return {
    auth: false,
    headers: token ? { "X-Admin-Token": token } : {},
  };
}

export function createAdminObservatoryClient(
  request: AdminRequester,
  readToken: AdminTokenReader,
) {
  const get = <T>(endpoint: string) => request<T>(endpoint, createAdminRequestOptions(readToken));

  return {
    listRecommendationRequests(query: AdminListQuery = {}) {
      return get<AdminListResponse<RecommendationRequestAudit>>(
        createAdminObservatoryEndpoint("/admin/recommendations/requests", query),
      );
    },

    getRecommendationRequest(id: string) {
      return get<RecommendationRequestTrace>(
        `/admin/recommendations/requests/${encodePathSegment(id)}`,
      );
    },

    getRecommendationFunnel(id: string) {
      return get<RecommendationFunnel>(
        `/admin/recommendations/requests/${encodePathSegment(id)}/funnel`,
      );
    },

    getRecommendationCandidates(id: string) {
      return get<RecommendationCandidatesResponse>(
        `/admin/recommendations/requests/${encodePathSegment(id)}/candidates`,
      );
    },

    getRecommendationFiltered(id: string) {
      return get<RecommendationFilteredResponse>(
        `/admin/recommendations/requests/${encodePathSegment(id)}/filtered`,
      );
    },

    getRecommendationGraph(id: string) {
      return get<unknown>(
        `/admin/recommendations/requests/${encodePathSegment(id)}/graph`,
      );
    },

    getUserRecommendationProfile(userId: string) {
      return get<UserRecommendationProfileResponse>(
        `/admin/users/${encodePathSegment(userId)}/recommendation-profile`,
      );
    },

    getUserPoolHealth(userId: string, query: AdminListQuery = {}) {
      return get<UserPoolHealthResponse>(
        createAdminObservatoryEndpoint(
          `/admin/users/${encodePathSegment(userId)}/pool-health`,
          query,
        ),
      );
    },

    listDiscoveryJobs(query: AdminListQuery = {}) {
      return get<AdminListResponse<DiscoveryJob>>(
        createAdminObservatoryEndpoint("/admin/discovery/jobs", query),
      );
    },

    getDiscoveryJob(id: string) {
      return get<DiscoveryJobDetailResponse>(
        `/admin/discovery/jobs/${encodePathSegment(id)}`,
      );
    },

    getArtistGraph(artistId: string) {
      return get<unknown>(`/admin/graph/artists/${encodePathSegment(artistId)}`);
    },

    getTrackGraph(trackId: string) {
      return get<unknown>(`/admin/graph/tracks/${encodePathSegment(trackId)}`);
    },

    getTrackVectorNeighbors(trackId: string) {
      return get<unknown>(`/admin/vector/tracks/${encodePathSegment(trackId)}/neighbors`);
    },

    getArtistVectorNeighbors(artistId: string) {
      return get<unknown>(`/admin/vector/artists/${encodePathSegment(artistId)}/neighbors`);
    },
  };
}
