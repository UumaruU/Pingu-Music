import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  Artist,
  EntityLoadStatus,
  ListenHistoryEntry,
  LocalDownloadEntry,
  Lyrics,
  PlayerSettings,
  Playlist,
  RecentSearch,
  Release,
  RepeatMode,
  SearchStatus,
  Track,
} from "../types";

type TrackMap = Record<string, Track>;
type ArtistMap = Record<string, Artist>;
type ReleaseMap = Record<string, Release>;
type LyricsMap = Record<string, Lyrics>;

const defaultPlayerSettings: PlayerSettings = {
  volume: 0.75,
  muted: false,
  repeatMode: "off",
  shuffleEnabled: false,
};

const LISTEN_HISTORY_TTL_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const LISTEN_HISTORY_TTL_MS = LISTEN_HISTORY_TTL_DAYS * DAY_MS;

function getDayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function sanitizeAndFilterListenHistory(
  history: ListenHistoryEntry[] | undefined,
  nowTimestamp = Date.now(),
) {
  if (!Array.isArray(history) || !history.length) {
    return [];
  }

  const normalized = history
    .map((entry) => {
      if (!entry || typeof entry.trackId !== "string" || typeof entry.listenedAt !== "string") {
        return null;
      }

      const listenedAtTimestamp = Date.parse(entry.listenedAt);

      if (!Number.isFinite(listenedAtTimestamp)) {
        return null;
      }

      const listenedAtDate = new Date(listenedAtTimestamp);
      const dayKey = typeof entry.dayKey === "string" && entry.dayKey
        ? entry.dayKey
        : getDayKey(listenedAtDate);

      return {
        id: `${entry.trackId}:${dayKey}`,
        trackId: entry.trackId,
        listenedAt: listenedAtDate.toISOString(),
        dayKey,
      } satisfies ListenHistoryEntry;
    })
    .filter((entry): entry is ListenHistoryEntry => !!entry)
    .filter((entry) => nowTimestamp - Date.parse(entry.listenedAt) <= LISTEN_HISTORY_TTL_MS);

  const deduped = new Map<string, ListenHistoryEntry>();

  normalized.forEach((entry) => {
    const existing = deduped.get(entry.id);

    if (!existing || Date.parse(entry.listenedAt) > Date.parse(existing.listenedAt)) {
      deduped.set(entry.id, entry);
    }
  });

  return [...deduped.values()].sort(
    (left, right) => Date.parse(right.listenedAt) - Date.parse(left.listenedAt),
  );
}

interface AppState {
  tracks: TrackMap;
  downloadedTracks: TrackMap;
  artists: ArtistMap;
  releases: ReleaseMap;
  lyricsByTrackId: LyricsMap;
  artistStatuses: Record<string, EntityLoadStatus>;
  artistTrackIdsByArtistId: Record<string, string[]>;
  artistTrackStatuses: Record<string, EntityLoadStatus>;
  releaseStatuses: Record<string, EntityLoadStatus>;
  popularTrackIds: string[];
  searchResultIds: string[];
  searchQuery: string;
  searchStatus: SearchStatus;
  searchError: string | null;
  recentSearches: RecentSearch[];
  listenHistory: ListenHistoryEntry[];
  favorites: string[];
  playlists: Playlist[];
  currentQueue: string[];
  originalQueue: string[];
  currentTrackIndex: number;
  currentTrackId: string | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  playerSettings: PlayerSettings;
  detailsTrackId: string | null;
  hydrateCatalog: (tracks: Track[]) => void;
  setPopularTracks: (tracks: Track[]) => void;
  setSearchState: (payload: {
    query: string;
    trackIds: string[];
    status: SearchStatus;
    error?: string | null;
  }) => void;
  addRecentSearch: (query: string) => void;
  addListenHistory: (trackId: string) => void;
  cleanupListenHistory: () => void;
  toggleFavorite: (trackId: string) => boolean;
  setTrackDownloadState: (
    trackId: string,
    downloadState: Track["downloadState"],
    localPath?: string,
    downloadError?: string,
  ) => void;
  syncDownloadsFromDisk: (downloads: LocalDownloadEntry[]) => void;
  setTrackMetadata: (trackId: string, patch: Partial<Track>) => void;
  hydrateArtists: (artists: Artist[]) => void;
  upsertRelease: (release: Release) => void;
  setArtistStatus: (artistId: string, status: EntityLoadStatus) => void;
  setArtistTracks: (artistId: string, trackIds: string[]) => void;
  setArtistTrackStatus: (artistId: string, status: EntityLoadStatus) => void;
  setReleaseStatus: (releaseId: string, status: EntityLoadStatus) => void;
  setLyrics: (lyrics: Lyrics) => void;
  createPlaylist: (name: string) => string;
  deletePlaylist: (playlistId: string) => void;
  addTrackToPlaylist: (playlistId: string, trackId: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  setQueue: (queueIds: string[], startTrackId: string, originalQueueIds?: string[]) => void;
  setCurrentTrackIndex: (index: number) => void;
  setPlaybackState: (isPlaying: boolean) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  setShuffleEnabled: (enabled: boolean) => void;
  setDetailsTrackId: (trackId: string | null) => void;
  restoreQueue: (queueIds: string[], currentTrackId: string | null, progress: number) => void;
}

function getPersistedTrackIds(
  state: Pick<
    AppState,
    | "favorites"
    | "playlists"
    | "currentQueue"
    | "originalQueue"
    | "currentTrackId"
    | "listenHistory"
    | "downloadedTracks"
  >,
) {
  const trackIds = new Set<string>();

  state.favorites.forEach((trackId) => trackIds.add(trackId));
  state.currentQueue.forEach((trackId) => trackIds.add(trackId));
  state.originalQueue.forEach((trackId) => trackIds.add(trackId));
  state.playlists.forEach((playlist) => {
    playlist.trackIds.forEach((trackId) => trackIds.add(trackId));
  });

  if (state.currentTrackId) {
    trackIds.add(state.currentTrackId);
  }

  state.listenHistory.forEach((entry) => {
    if (entry.trackId) {
      trackIds.add(entry.trackId);
    }
  });

  Object.keys(state.downloadedTracks).forEach((trackId) => {
    trackIds.add(trackId);
  });

  return trackIds;
}

function pickTracksForPersistence(tracks: TrackMap | undefined, trackIds: Set<string>) {
  if (!tracks || !trackIds.size) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(tracks).filter(([trackId]) => trackIds.has(trackId)),
  );
}

function mergeTrack(
  existingTrack: Track | undefined,
  nextTrack: Track,
  favoriteTrackIds?: Set<string>,
): Track {
  const isFavorite = favoriteTrackIds
    ? favoriteTrackIds.has(nextTrack.id)
    : existingTrack?.isFavorite ?? nextTrack.isFavorite;
  const metadataTrack =
    existingTrack && existingTrack.metadataStatus !== "raw" ? existingTrack : nextTrack;

  return {
    ...nextTrack,
    coverUrl: metadataTrack.coverUrl || nextTrack.coverUrl,
    isFavorite,
    downloadState: isFavorite
      ? existingTrack?.downloadState ?? nextTrack.downloadState
      : "idle",
    localPath: isFavorite ? existingTrack?.localPath ?? nextTrack.localPath : undefined,
    downloadError: isFavorite
      ? existingTrack?.downloadError ?? nextTrack.downloadError
      : undefined,
    musicBrainzRecordingId:
      existingTrack?.musicBrainzRecordingId ?? nextTrack.musicBrainzRecordingId,
    musicBrainzArtistId: existingTrack?.musicBrainzArtistId ?? nextTrack.musicBrainzArtistId,
    musicBrainzReleaseId:
      existingTrack?.musicBrainzReleaseId ?? nextTrack.musicBrainzReleaseId,
    musicBrainzReleaseGroupId:
      existingTrack?.musicBrainzReleaseGroupId ?? nextTrack.musicBrainzReleaseGroupId,
    normalizedTitle: existingTrack?.normalizedTitle ?? nextTrack.normalizedTitle,
    normalizedArtistName:
      existingTrack?.normalizedArtistName ?? nextTrack.normalizedArtistName,
    metadataStatus: existingTrack?.metadataStatus ?? nextTrack.metadataStatus,
    albumTitle: existingTrack?.albumTitle ?? nextTrack.albumTitle,
    releaseDate: existingTrack?.releaseDate ?? nextTrack.releaseDate,
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      tracks: {},
      downloadedTracks: {},
      artists: {},
      releases: {},
      lyricsByTrackId: {},
      artistStatuses: {},
      artistTrackIdsByArtistId: {},
      artistTrackStatuses: {},
      releaseStatuses: {},
      popularTrackIds: [],
      searchResultIds: [],
      searchQuery: "",
      searchStatus: "idle",
      searchError: null,
      recentSearches: [],
      listenHistory: [],
      favorites: [],
      playlists: [],
      currentQueue: [],
      originalQueue: [],
      currentTrackIndex: -1,
      currentTrackId: null,
      isPlaying: false,
      progress: 0,
      duration: 0,
      playerSettings: defaultPlayerSettings,
      detailsTrackId: null,
      hydrateCatalog: (tracks) => {
        set((state) => {
          const nextTracks = { ...state.tracks };
          const nextDownloadedTracks = { ...state.downloadedTracks };
          const favoriteTrackIds = new Set(state.favorites);

          for (const track of tracks) {
            nextTracks[track.id] = mergeTrack(state.tracks[track.id], track, favoriteTrackIds);

            if (state.downloadedTracks[track.id]) {
              nextDownloadedTracks[track.id] = {
                ...mergeTrack(state.downloadedTracks[track.id], track, favoriteTrackIds),
                isFavorite: true,
                downloadState: "downloaded",
                localPath: state.downloadedTracks[track.id].localPath,
                downloadError: undefined,
              };
            }
          }

          return {
            tracks: nextTracks,
            downloadedTracks: nextDownloadedTracks,
          };
        });
      },
      setPopularTracks: (tracks) => {
        get().hydrateCatalog(tracks);
        set({ popularTrackIds: tracks.map((track) => track.id) });
      },
      setSearchState: ({ query, trackIds, status, error = null }) => {
        set({
          searchQuery: query,
          searchResultIds: trackIds,
          searchStatus: status,
          searchError: error,
        });
      },
      addRecentSearch: (query) => {
        const normalized = query.trim();

        if (!normalized) {
          return;
        }

        set((state) => {
          const nextSearch: RecentSearch = {
            id: `${Date.now()}`,
            query: normalized,
            createdAt: new Date().toISOString(),
          };

          const deduped = state.recentSearches.filter(
            (item) => item.query.toLowerCase() !== normalized.toLowerCase(),
          );

          return {
            recentSearches: [nextSearch, ...deduped].slice(0, 8),
          };
        });
      },
      addListenHistory: (trackId) => {
        if (!trackId) {
          return;
        }

        set((state) => {
          const now = new Date();
          const nowIso = now.toISOString();
          const nowTimestamp = now.getTime();
          const dayKey = getDayKey(now);
          const cleanedHistory = sanitizeAndFilterListenHistory(state.listenHistory, nowTimestamp);
          const nextId = `${trackId}:${dayKey}`;
          const existingIndex = cleanedHistory.findIndex((entry) => entry.id === nextId);

          if (existingIndex >= 0) {
            const existing = cleanedHistory[existingIndex];
            const nextHistory = cleanedHistory.filter((entry) => entry.id !== nextId);
            nextHistory.unshift({
              ...existing,
              listenedAt: nowIso,
            });

            return { listenHistory: nextHistory };
          }

          return {
            listenHistory: [
              {
                id: nextId,
                trackId,
                listenedAt: nowIso,
                dayKey,
              },
              ...cleanedHistory,
            ],
          };
        });
      },
      cleanupListenHistory: () => {
        set((state) => ({
          listenHistory: sanitizeAndFilterListenHistory(state.listenHistory),
        }));
      },
      toggleFavorite: (trackId) => {
        const isFavorite = !get().favorites.includes(trackId);

        set((state) => ({
          favorites: isFavorite
            ? [trackId, ...state.favorites.filter((id) => id !== trackId)]
            : state.favorites.filter((id) => id !== trackId),
          tracks: {
            ...state.tracks,
            [trackId]: state.tracks[trackId]
              ? { ...state.tracks[trackId], isFavorite }
              : state.tracks[trackId],
          },
        }));

        return isFavorite;
      },
      setTrackDownloadState: (trackId, downloadState, localPath, downloadError) => {
        set((state) => {
          const baseTrack = state.tracks[trackId] ?? state.downloadedTracks[trackId];

          if (!baseTrack) {
            return state;
          }

          const nextTrack: Track = {
            ...baseTrack,
            downloadState,
            localPath,
            downloadError,
            isFavorite: downloadState === "downloaded" ? true : baseTrack.isFavorite,
          };
          const nextDownloadedTracks = { ...state.downloadedTracks };

          if (downloadState === "downloaded" && localPath) {
            nextDownloadedTracks[trackId] = {
              ...nextTrack,
              isFavorite: true,
              downloadState: "downloaded",
              localPath,
              downloadError: undefined,
            };
          } else {
            delete nextDownloadedTracks[trackId];
          }

          return {
            tracks: {
              ...state.tracks,
              [trackId]: nextTrack,
            },
            downloadedTracks: nextDownloadedTracks,
          };
        });
      },
      syncDownloadsFromDisk: (downloads) => {
        set((state) => {
          const nextTracks = { ...state.tracks };
          const nextDownloadedTracks: TrackMap = {};
          const diskDownloadIds = new Set(downloads.map((download) => download.trackId));
          const downloadByTrackId = new Map(downloads.map((download) => [download.trackId, download]));
          const nextFavorites = state.favorites.filter((trackId) => {
            const knownTrack = state.tracks[trackId] ?? state.downloadedTracks[trackId];
            return !!knownTrack;
          });
          const favoriteTrackIds = new Set(nextFavorites);
          const trackedDownloadIds = new Set([
            ...state.favorites,
            ...Object.keys(state.downloadedTracks),
          ]);

          for (const [trackId, track] of Object.entries(state.downloadedTracks)) {
            if (diskDownloadIds.has(trackId)) {
              nextDownloadedTracks[trackId] = track;
              continue;
            }

            if (nextTracks[trackId]) {
              nextTracks[trackId] = {
                ...nextTracks[trackId],
                downloadState: "idle",
                localPath: undefined,
                downloadError: undefined,
              };
            }
          }

          for (const trackId of trackedDownloadIds) {
            const download = downloadByTrackId.get(trackId);
            const snapshot = state.tracks[trackId] ?? state.downloadedTracks[trackId];

            if (!download || !snapshot) {
              continue;
            }

            const restoredTrack: Track = snapshot
              ? {
                  ...snapshot,
                  isFavorite: true,
                  downloadState: "downloaded",
                  localPath: download.localPath,
                  downloadError: undefined,
                }
              : snapshot;

            nextDownloadedTracks[trackId] = restoredTrack;
            nextTracks[trackId] = restoredTrack;

            if (!favoriteTrackIds.has(trackId)) {
              nextFavorites.push(trackId);
              favoriteTrackIds.add(trackId);
            }
          }

          return {
            tracks: nextTracks,
            downloadedTracks: nextDownloadedTracks,
            favorites: nextFavorites,
          };
        });
      },
      setTrackMetadata: (trackId, patch) => {
        set((state) => ({
          tracks: {
            ...state.tracks,
            [trackId]: state.tracks[trackId]
              ? {
                  ...state.tracks[trackId],
                  ...patch,
                }
              : state.tracks[trackId],
          },
          downloadedTracks: {
            ...state.downloadedTracks,
            [trackId]: state.downloadedTracks[trackId]
              ? {
                  ...state.downloadedTracks[trackId],
                  ...patch,
                }
              : state.downloadedTracks[trackId],
          },
        }));
      },
      hydrateArtists: (artists) => {
        set((state) => ({
          artists: {
            ...state.artists,
            ...Object.fromEntries(artists.map((artist) => [artist.id, artist])),
          },
          artistStatuses: {
            ...state.artistStatuses,
            ...Object.fromEntries(artists.map((artist) => [artist.id, "ready"])),
          },
        }));
      },
      upsertRelease: (release) => {
        set((state) => ({
          releases: {
            ...state.releases,
            [release.id]: {
              ...state.releases[release.id],
              ...release,
              trackIds: release.trackIds ?? state.releases[release.id]?.trackIds,
              trackTitles: release.trackTitles ?? state.releases[release.id]?.trackTitles,
            },
          },
        }));
      },
      setArtistStatus: (artistId, status) => {
        set((state) => ({
          artistStatuses: {
            ...state.artistStatuses,
            [artistId]: status,
          },
        }));
      },
      setArtistTracks: (artistId, trackIds) => {
        set((state) => ({
          artistTrackIdsByArtistId: {
            ...state.artistTrackIdsByArtistId,
            [artistId]: trackIds,
          },
        }));
      },
      setArtistTrackStatus: (artistId, status) => {
        set((state) => ({
          artistTrackStatuses: {
            ...state.artistTrackStatuses,
            [artistId]: status,
          },
        }));
      },
      setReleaseStatus: (releaseId, status) => {
        set((state) => ({
          releaseStatuses: {
            ...state.releaseStatuses,
            [releaseId]: status,
          },
        }));
      },
      setLyrics: (lyrics) => {
        set((state) => ({
          lyricsByTrackId: {
            ...state.lyricsByTrackId,
            [lyrics.trackId]: lyrics,
          },
        }));
      },
      createPlaylist: (name) => {
        const playlistId = crypto.randomUUID();
        set((state) => ({
          playlists: [
            {
              id: playlistId,
              name,
              trackIds: [],
              createdAt: new Date().toISOString(),
            },
            ...state.playlists,
          ],
        }));
        return playlistId;
      },
      deletePlaylist: (playlistId) => {
        set((state) => ({
          playlists: state.playlists.filter((playlist) => playlist.id !== playlistId),
        }));
      },
      addTrackToPlaylist: (playlistId, trackId) => {
        set((state) => ({
          playlists: state.playlists.map((playlist) =>
            playlist.id === playlistId && !playlist.trackIds.includes(trackId)
              ? { ...playlist, trackIds: [...playlist.trackIds, trackId] }
              : playlist,
          ),
        }));
      },
      removeTrackFromPlaylist: (playlistId, trackId) => {
        set((state) => ({
          playlists: state.playlists.map((playlist) =>
            playlist.id === playlistId
              ? {
                  ...playlist,
                  trackIds: playlist.trackIds.filter((id) => id !== trackId),
                }
              : playlist,
          ),
        }));
      },
      setQueue: (queueIds, startTrackId, originalQueueIds) => {
        const currentTrackIndex = queueIds.findIndex((trackId) => trackId === startTrackId);

        set({
          currentQueue: queueIds,
          originalQueue: originalQueueIds ?? queueIds,
          currentTrackIndex,
          currentTrackId: startTrackId,
          progress: 0,
        });
      },
      setCurrentTrackIndex: (index) => {
        set((state) => ({
          currentTrackIndex: index,
          currentTrackId: index >= 0 ? state.currentQueue[index] ?? null : null,
          progress: 0,
        }));
      },
      setPlaybackState: (isPlaying) => set({ isPlaying }),
      setProgress: (progress) => set({ progress }),
      setDuration: (duration) => set({ duration }),
      setVolume: (volume) =>
        set((state) => ({ playerSettings: { ...state.playerSettings, volume } })),
      setMuted: (muted) =>
        set((state) => ({ playerSettings: { ...state.playerSettings, muted } })),
      setRepeatMode: (repeatMode) =>
        set((state) => ({ playerSettings: { ...state.playerSettings, repeatMode } })),
      setShuffleEnabled: (shuffleEnabled) =>
        set((state) => ({ playerSettings: { ...state.playerSettings, shuffleEnabled } })),
      setDetailsTrackId: (trackId) => set({ detailsTrackId: trackId }),
      restoreQueue: (queueIds, currentTrackId, progress) => {
        const currentTrackIndex =
          currentTrackId === null ? -1 : queueIds.findIndex((trackId) => trackId === currentTrackId);

        set({
          currentQueue: queueIds,
          originalQueue: queueIds,
          currentTrackIndex,
          currentTrackId,
          progress,
        });
      },
    }),
    {
      name: "app-state",
      version: 9,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState) => {
        const state = persistedState as Partial<AppState> | undefined;

        if (!state) {
          return persistedState as unknown as AppState;
        }

        const favorites = Array.isArray(state.favorites) ? state.favorites : [];
        const playlists = Array.isArray(state.playlists) ? state.playlists : [];
        const currentQueue = Array.isArray(state.currentQueue) ? state.currentQueue : [];
        const originalQueue = Array.isArray(state.originalQueue)
          ? state.originalQueue
          : currentQueue;
        const downloadedTracks =
          state.downloadedTracks && typeof state.downloadedTracks === "object"
            ? (state.downloadedTracks as TrackMap)
            : {};
        const currentTrackId =
          typeof state.currentTrackId === "string" ? state.currentTrackId : null;
        const listenHistory = sanitizeAndFilterListenHistory(
          state.listenHistory as ListenHistoryEntry[] | undefined,
        );
        const persistedTrackIds = getPersistedTrackIds({
          favorites,
          playlists,
          currentQueue,
          originalQueue,
          currentTrackId,
          listenHistory,
          downloadedTracks,
        });

        return {
          ...state,
          tracks: pickTracksForPersistence(state.tracks as TrackMap | undefined, persistedTrackIds),
          downloadedTracks,
          artists: {},
          releases: {},
          lyricsByTrackId: {},
          artistStatuses: {},
          artistTrackIdsByArtistId: {},
          artistTrackStatuses: {},
          releaseStatuses: {},
          popularTrackIds: [],
          searchResultIds: [],
          searchStatus: "idle",
          searchError: null,
          recentSearches: Array.isArray(state.recentSearches) ? state.recentSearches : [],
          listenHistory,
          favorites,
          playlists,
          currentQueue,
          originalQueue,
          currentTrackIndex:
            typeof state.currentTrackIndex === "number" ? state.currentTrackIndex : -1,
          currentTrackId,
          isPlaying: false,
          progress: typeof state.progress === "number" ? state.progress : 0,
          duration: 0,
          detailsTrackId: null,
          playerSettings: state.playerSettings ?? defaultPlayerSettings,
          searchQuery: typeof state.searchQuery === "string" ? state.searchQuery : "",
        } as AppState;
      },
      partialize: (state) => {
        const listenHistory = sanitizeAndFilterListenHistory(state.listenHistory);
        const persistedTrackIds = getPersistedTrackIds({
          ...state,
          listenHistory,
        });

        return {
          tracks: pickTracksForPersistence(state.tracks, persistedTrackIds),
          downloadedTracks: state.downloadedTracks,
          searchQuery: state.searchQuery,
          recentSearches: state.recentSearches,
          listenHistory,
          favorites: state.favorites,
          playlists: state.playlists,
          currentQueue: state.currentQueue,
          originalQueue: state.originalQueue,
          currentTrackIndex: state.currentTrackIndex,
          currentTrackId: state.currentTrackId,
          progress: state.progress,
          playerSettings: state.playerSettings,
        };
      },
    },
  ),
);
