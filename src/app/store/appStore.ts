import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  PlayerSettings,
  Playlist,
  RecentSearch,
  RepeatMode,
  SearchStatus,
  Track,
} from "../types";
type TrackMap = Record<string, Track>;

const defaultPlayerSettings: PlayerSettings = {
  volume: 0.75,
  muted: false,
  repeatMode: "off",
  shuffleEnabled: false,
};

interface AppState {
  tracks: TrackMap;
  popularTrackIds: string[];
  searchResultIds: string[];
  searchQuery: string;
  searchStatus: SearchStatus;
  searchError: string | null;
  recentSearches: RecentSearch[];
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
  lyricsTrackId: string | null;
  hydrateCatalog: (tracks: Track[]) => void;
  setPopularTracks: (tracks: Track[]) => void;
  setSearchState: (payload: {
    query: string;
    trackIds: string[];
    status: SearchStatus;
    error?: string | null;
  }) => void;
  addRecentSearch: (query: string) => void;
  toggleFavorite: (trackId: string) => boolean;
  setTrackDownloadState: (
    trackId: string,
    downloadState: Track["downloadState"],
    localPath?: string,
    downloadError?: string,
  ) => void;
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
  setLyricsTrackId: (trackId: string | null) => void;
  restoreQueue: (queueIds: string[], currentTrackId: string | null, progress: number) => void;
}

function mergeTrack(existingTrack: Track | undefined, nextTrack: Track): Track {
  const isFavorite = existingTrack?.isFavorite ?? nextTrack.isFavorite;

  if (!isFavorite) {
    return {
      ...nextTrack,
      isFavorite: false,
      downloadState: "idle",
      localPath: undefined,
      downloadError: undefined,
    };
  }

  return {
    ...nextTrack,
    isFavorite,
    downloadState: existingTrack?.downloadState ?? nextTrack.downloadState,
    localPath: existingTrack?.localPath ?? nextTrack.localPath,
    downloadError: existingTrack?.downloadError ?? nextTrack.downloadError,
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      tracks: {},
      popularTrackIds: [],
      searchResultIds: [],
      searchQuery: "",
      searchStatus: "idle",
      searchError: null,
      recentSearches: [],
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
      lyricsTrackId: null,
      hydrateCatalog: (tracks) => {
        set((state) => {
          const nextTracks = { ...state.tracks };

          for (const track of tracks) {
            nextTracks[track.id] = mergeTrack(state.tracks[track.id], track);
          }

          return { tracks: nextTracks };
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
        set((state) => ({
          tracks: {
            ...state.tracks,
            [trackId]: state.tracks[trackId]
              ? {
                  ...state.tracks[trackId],
                  downloadState,
                  localPath,
                  downloadError,
                }
              : state.tracks[trackId],
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
      setLyricsTrackId: (trackId) => set({ lyricsTrackId: trackId }),
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
      version: 4,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState) => {
        const state = persistedState as Partial<AppState> | undefined;

        if (!state) {
          return persistedState as unknown as AppState;
        }

        return {
          ...state,
          tracks: {},
          popularTrackIds: [],
          searchResultIds: [],
          currentQueue: [],
          originalQueue: [],
          currentTrackIndex: -1,
          currentTrackId: null,
          progress: 0,
          duration: 0,
          lyricsTrackId: null,
        } as AppState;
      },
      partialize: (state) => ({
        tracks: state.tracks,
        popularTrackIds: state.popularTrackIds,
        searchQuery: state.searchQuery,
        recentSearches: state.recentSearches,
        favorites: state.favorites,
        playlists: state.playlists,
        currentQueue: state.currentQueue,
        originalQueue: state.originalQueue,
        currentTrackIndex: state.currentTrackIndex,
        currentTrackId: state.currentTrackId,
        progress: state.progress,
        playerSettings: state.playerSettings,
      }),
    },
  ),
);
