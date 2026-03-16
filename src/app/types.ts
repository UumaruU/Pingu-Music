export type RouteId =
  | "home"
  | "history"
  | "favorites"
  | "playlists"
  | "search"
  | "login"
  | "register"
  | "artist"
  | "release";

export type RepeatMode = "off" | "one" | "all";
export type DownloadState = "idle" | "downloading" | "downloaded" | "error";
export type SearchStatus = "idle" | "loading" | "success" | "empty" | "error";
export type MetadataStatus = "raw" | "matching" | "matched" | "enriched" | "failed";
export type LyricsStatus = "missing" | "loading" | "ready" | "failed";
export type EntityLoadStatus = "idle" | "loading" | "ready" | "failed";
export type AuthStatus = "idle" | "loading" | "authenticated" | "guest" | "error";
export type SyncStatus = "idle" | "syncing" | "synced" | "error";
export type AuthError = string | null;
export type ProviderId = "hitmos" | "lmusic" | "soundcloud" | "telegram";
export type CanonicalTrackId = string;
export type TitleFlavor =
  | "original"
  | "live"
  | "acoustic"
  | "instrumental"
  | "karaoke"
  | "remix"
  | "edit"
  | "radio_edit"
  | "extended"
  | "demo"
  | "cover"
  | "versioned_unknown";
export type FingerprintStatus = "missing" | "pending" | "ready" | "failed";
export type CanonicalReasonCode =
  | "same_mb_recording_id"
  | "same_acoustid"
  | "title_core_exact"
  | "artist_core_exact"
  | "duration_close"
  | "flavor_conflict"
  | "conflicting_mb_recording_ids"
  | "primary_artist_conflict"
  | "duration_too_far"
  | "title_too_different";
export type CanonicalizationVersion = number;
export type CanonicalClusterRevision = number;
export type CanonicalIdRemapReason = "identifier_upgrade" | "cluster_split" | "cluster_recompute";

export interface CanonicalizationConfig {
  strictMergeThreshold: number;
  relaxedMergeThreshold: number;
  maxDurationDeltaMsStrict: number;
  maxDurationDeltaMsRelaxed: number;
  titleExactBoost: number;
  artistExactBoost: number;
  mbRecordingMatchBoost: number;
  acoustIdMatchBoost: number;
  titleFlavorConflictPenalty: number;
  artistMismatchPenalty: number;
  durationMismatchPenalty: number;
  blockOnFlavorConflict: boolean;
  blockOnConflictingMbRecordingIds: boolean;
  blockOnPrimaryArtistConflict: boolean;
  enableTrackCanonicalization: boolean;
  enableAggressiveDedup: boolean;
  enableFingerprintFallback: boolean;
  lyricsDurationBucketMs: number;
  minCanonicalConfidenceForLyricsReuse: number;
  sourcePriorityByProvider: Record<ProviderId, number>;
  sourceTrustByProvider: Record<ProviderId, number>;
}

export interface Track {
  id: string;
  providerId: ProviderId;
  providerTrackId?: string;
  title: string;
  artist: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  sourceUrl: string;
  isFavorite: boolean;
  downloadState: DownloadState;
  localPath?: string;
  downloadError?: string;
  musicBrainzRecordingId?: string;
  musicBrainzArtistId?: string;
  musicBrainzReleaseId?: string;
  musicBrainzReleaseGroupId?: string;
  normalizedTitle?: string;
  normalizedArtistName?: string;
  metadataStatus: MetadataStatus;
  albumTitle?: string;
  releaseDate?: string;
  explicit?: boolean | null;
  normalizedTitleCore?: string;
  normalizedArtistCore?: string;
  primaryArtist?: string;
  titleFlavor?: TitleFlavor[];
  canonicalId?: CanonicalTrackId;
  acoustId?: string;
  fingerprintStatus?: FingerprintStatus;
  sourceTrustScore?: number;
  sourcePriority?: number;
}

export interface Artist {
  id: string;
  name: string;
  musicBrainzArtistId: string;
  type?: string;
  country?: string;
  area?: string;
  beginArea?: string;
  disambiguation?: string;
  beginDate?: string;
  endDate?: string;
  tags?: string[];
  imageUrl?: string;
}

export interface Release {
  id: string;
  title: string;
  musicBrainzReleaseId: string;
  musicBrainzReleaseGroupId?: string;
  artistId?: string;
  artistName?: string;
  kind?: "album" | "single" | "other";
  date?: string;
  country?: string;
  coverUrl?: string;
  trackTitles?: string[];
  trackIds?: string[];
}

export interface Lyrics {
  trackId: string;
  plain?: string;
  synced?: string;
  source: string;
  status: LyricsStatus;
  error?: string;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
}

export interface PlayerSettings {
  volume: number;
  muted: boolean;
  repeatMode: RepeatMode;
  shuffleEnabled: boolean;
}

export interface RecentSearch {
  id: string;
  query: string;
  createdAt: string;
}

export interface ListenHistoryEntry {
  id: string;
  trackId: string;
  listenedAt: string;
  dayKey: string;
}

export interface LocalDownloadEntry {
  trackId: string;
  localPath: string;
}

export interface RouteState {
  page: RouteId;
  playlistId?: string;
  artistId?: string;
  releaseId?: string;
}

export interface AuthUser {
  id: string;
  login: string;
  name?: string;
  avatarUrl?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

export interface AuthSession {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: AuthError;
  status: AuthStatus;
}

export interface CanonicalAliasTarget {
  canonicalId: CanonicalTrackId;
  searchSetId: string;
  canonicalizationVersion: CanonicalizationVersion;
  canonicalizationRevision: number;
  clusterRevision: CanonicalClusterRevision;
  reason: CanonicalIdRemapReason;
}

export interface CanonicalIdRemap {
  fromCanonicalId: CanonicalTrackId;
  toCanonicalId: CanonicalTrackId;
  searchSetId: string;
  canonicalizationVersion: CanonicalizationVersion;
  canonicalizationRevision: number;
  clusterRevision: CanonicalClusterRevision;
  reason: CanonicalIdRemapReason;
  variantTrackIds: string[];
  occurredAt: string;
}

export interface CanonicalPairScoringResult {
  leftTrackId: string;
  rightTrackId: string;
  score: number;
  reasons: CanonicalReasonCode[];
  blockers: CanonicalReasonCode[];
}

export interface CanonicalDebugInfo {
  blockingKeys: string[];
  pairScoring: CanonicalPairScoringResult[];
  mergeBlockers: CanonicalReasonCode[];
  clusterReasons: CanonicalReasonCode[];
  aliasRemapHistory: CanonicalIdRemap[];
}

export interface CanonicalTrack {
  canonicalId: CanonicalTrackId;
  searchSetId: string;
  canonicalizationVersion: CanonicalizationVersion;
  canonicalizationRevision: number;
  clusterRevision: CanonicalClusterRevision;
  title: string;
  artist: string;
  album?: string | null;
  coverUrl?: string | null;
  lyrics?: string | null;
  explicit?: boolean | null;
  normalizedTitleCore?: string | null;
  normalizedArtistCore?: string | null;
  primaryArtist?: string | null;
  titleFlavor: TitleFlavor[];
  targetDuration?: number | null;
  variantTrackIds: string[];
  preferredVariantId?: string | null;
  musicBrainzRecordingId?: string | null;
  musicBrainzArtistId?: string | null;
  musicBrainzReleaseId?: string | null;
  musicBrainzReleaseGroupId?: string | null;
  acoustId?: string | null;
  provenance?: {
    title?: string;
    artist?: string;
    album?: string;
    coverUrl?: string;
    lyrics?: string;
    targetDuration?: string;
    preferredVariantId?: string;
  };
  quality?: {
    clusterConfidence?: number;
    dedupReason?: CanonicalReasonCode[];
    lastComputedAt?: string;
    sourcePriority?: number;
    sourceTrustScore?: number;
  };
  debugInfo?: CanonicalDebugInfo;
}

export interface CanonicalizationResult {
  searchSetId: string;
  canonicalizationVersion: CanonicalizationVersion;
  canonicalizationRevision: number;
  canonicalTracks: CanonicalTrack[];
  canonicalById: Record<CanonicalTrackId, CanonicalTrack>;
  canonicalIdByVariantTrackId: Record<string, CanonicalTrackId>;
  variantTrackIdsByCanonicalId: Record<CanonicalTrackId, string[]>;
  searchCanonicalResultIds: CanonicalTrackId[];
  aliasTargetsByCanonicalId: Record<CanonicalTrackId, CanonicalAliasTarget>;
  remaps: CanonicalIdRemap[];
}
