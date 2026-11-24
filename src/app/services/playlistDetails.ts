import { Playlist } from "../types";

export const PLAYLIST_COVER_ACCENTS = [
  "#23d3ee",
  "#ff4dd2",
  "#37d46b",
  "#f5c96b",
  "#8f7cff",
  "#ff6d5f",
];

export type PlaylistDetailsDraft = {
  name?: string;
  coverUrl?: string;
  coverAccent?: string;
};

export type NormalizedPlaylistDetails = {
  name: string;
  coverUrl?: string;
  coverAccent?: string;
};

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function normalizePlaylistDetailsDraft(
  draft: PlaylistDetailsDraft,
): NormalizedPlaylistDetails {
  return {
    name: normalizeOptionalText(draft.name) ?? "Новый плейлист",
    coverUrl: normalizeOptionalText(draft.coverUrl),
    coverAccent: normalizeOptionalText(draft.coverAccent),
  };
}

export function applyPlaylistDetailsPatch(
  playlist: Playlist,
  patch: PlaylistDetailsDraft,
  updatedAt = new Date().toISOString(),
): Playlist {
  const normalized = normalizePlaylistDetailsDraft({
    name: patch.name ?? playlist.name,
    coverUrl: patch.coverUrl ?? playlist.coverUrl,
    coverAccent: patch.coverAccent ?? playlist.coverAccent,
  });

  return {
    ...playlist,
    name: normalized.name,
    coverUrl: normalized.coverUrl,
    coverAccent: normalized.coverAccent,
    updatedAt,
  };
}
