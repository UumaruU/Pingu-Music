export type RouteId = "home" | "favorites" | "playlists" | "search" | "artist" | "release";

export type RepeatMode = "off" | "one" | "all";
export type DownloadState = "idle" | "downloading" | "downloaded" | "error";
export type SearchStatus = "idle" | "loading" | "success" | "empty" | "error";
export type MetadataStatus = "raw" | "matching" | "matched" | "enriched" | "failed";
export type LyricsStatus = "missing" | "loading" | "ready" | "failed";
export type EntityLoadStatus = "idle" | "loading" | "ready" | "failed";

export interface Track {
  id: string;
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

export interface RouteState {
  page: RouteId;
  playlistId?: string;
  artistId?: string;
  releaseId?: string;
}
