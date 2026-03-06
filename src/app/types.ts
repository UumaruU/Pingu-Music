export type RouteId = "home" | "favorites" | "playlists" | "search";

export type RepeatMode = "off" | "one" | "all";
export type DownloadState = "idle" | "downloading" | "downloaded" | "error";
export type SearchStatus = "idle" | "loading" | "success" | "empty" | "error";

export interface Track {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  sourceUrl: string;
  lyrics?: string;
  isFavorite: boolean;
  downloadState: DownloadState;
  localPath?: string;
  downloadError?: string;
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
}
