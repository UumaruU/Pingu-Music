import { ApiClientError, ApiRequestOptions, apiClient } from "./apiClient";
import { downloadService } from "./downloadService";
import { serverTrackCatalogService } from "./serverTrackCatalogService";
import { withTrackProviderDefaults } from "../core/tracks/trackIdentity";
import { useAppStore } from "../store/appStore";
import { ListenHistoryEntry, RecentSearch, SyncStatus, Track } from "../types";

interface SyncResult {
  status: SyncStatus;
  merged: boolean;
  conflictNames: string[];
}

interface FavoritesSyncState {
  favoriteIds: string[];
  tracks: Track[];
}

const FAVORITES_PULL_ENDPOINTS = ["/sync/favorites"];
const FAVORITES_PUSH_ENDPOINTS = ["/sync/favorites"];
const HISTORY_PULL_ENDPOINTS = ["/sync/history"];
const HISTORY_PUSH_ENDPOINTS = ["/sync/history"];
const SEARCH_HISTORY_PULL_ENDPOINTS = ["/sync/search-history"];
const SEARCH_HISTORY_PUSH_ENDPOINTS = ["/sync/search-history"];

let realtimeSyncInitialized = false;
let realtimeSyncEnabled = false;
let suppressedRealtimeSyncDepth = 0;

const queuedSyncState = {
  favorites: {
    pending: null as string[] | null,
    inFlight: null as Promise<void> | null,
    retryTimer: null as ReturnType<typeof setTimeout> | null,
  },
  history: {
    pending: null as ListenHistoryEntry[] | null,
    inFlight: null as Promise<void> | null,
    retryTimer: null as ReturnType<typeof setTimeout> | null,
  },
  searchHistory: {
    pending: null as RecentSearch[] | null,
    inFlight: null as Promise<void> | null,
    retryTimer: null as ReturnType<typeof setTimeout> | null,
  },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function extractArrayPayload(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = asRecord(payload);

  if (!record) {
    return [];
  }

  if (Array.isArray(record.items)) {
    return record.items;
  }

  if (Array.isArray(record.data)) {
    return record.data;
  }

  if (Array.isArray(record.favorites)) {
    return record.favorites;
  }

  return [];
}

function normalizeFavorites(payload: unknown) {
  const result = extractArrayPayload(payload)
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }

      const record = asRecord(item);
      if (!record) {
        return "";
      }

      const trackId = record.trackId ?? record.id;
      return typeof trackId === "string" ? trackId.trim() : "";
    })
    .filter(Boolean);

  return [...new Set(result)];
}

function normalizeFavoriteTracks(payload: unknown): Track[] {
  const record = asRecord(payload);
  const rawTracks = Array.isArray(record?.tracks) ? record.tracks : [];

  return rawTracks
    .map((item) => {
      const track = asRecord(item);
      if (!track) {
        return null;
      }

      const id = typeof track.id === "string" && track.id.trim() ? track.id.trim() : "";
      const title = typeof track.title === "string" && track.title.trim() ? track.title.trim() : "";
      const artist =
        typeof track.artist === "string" && track.artist.trim() ? track.artist.trim() : "";
      const audioUrl =
        typeof track.audioUrl === "string" && track.audioUrl.trim() ? track.audioUrl.trim() : "";

      if (!id || !title || !artist || !audioUrl) {
        return null;
      }

      return withTrackProviderDefaults({
        id,
        providerId:
          track.providerId === "hitmos" ||
          track.providerId === "lmusic" ||
          track.providerId === "soundcloud" ||
          track.providerId === "telegram"
            ? track.providerId
            : "hitmos",
        providerTrackId:
          typeof track.providerTrackId === "string" && track.providerTrackId.trim()
            ? track.providerTrackId.trim()
            : id.includes(":")
              ? id.slice(id.indexOf(":") + 1)
              : id,
        title,
        artist,
        coverUrl:
          typeof track.coverUrl === "string" && track.coverUrl.trim()
            ? track.coverUrl.trim()
            : "https://placehold.co/300x300?text=Pingu+Music",
        audioUrl,
        duration:
          typeof track.duration === "number" && Number.isFinite(track.duration)
            ? track.duration
            : 0,
        sourceUrl:
          typeof track.sourceUrl === "string" && track.sourceUrl.trim()
            ? track.sourceUrl.trim()
            : "https://rus.hitmotop.com",
        isFavorite: true,
        downloadState: "idle",
        metadataStatus:
          track.metadataStatus === "matching" ||
          track.metadataStatus === "matched" ||
          track.metadataStatus === "enriched"
            ? track.metadataStatus
            : "raw",
        albumTitle:
          typeof track.albumTitle === "string" && track.albumTitle.trim()
            ? track.albumTitle.trim()
            : undefined,
        musicBrainzRecordingId:
          typeof track.musicBrainzRecordingId === "string" && track.musicBrainzRecordingId.trim()
            ? track.musicBrainzRecordingId.trim()
            : undefined,
        musicBrainzArtistId:
          typeof track.musicBrainzArtistId === "string" && track.musicBrainzArtistId.trim()
            ? track.musicBrainzArtistId.trim()
            : undefined,
        musicBrainzReleaseId:
          typeof track.musicBrainzReleaseId === "string" && track.musicBrainzReleaseId.trim()
            ? track.musicBrainzReleaseId.trim()
            : undefined,
      } satisfies Track);
    })
    .filter((track): track is Track => !!track);
}

function normalizeHistory(payload: unknown): ListenHistoryEntry[] {
  const normalized = extractArrayPayload(payload)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      const trackId = typeof record.trackId === "string" ? record.trackId.trim() : "";
      const listenedAt =
        typeof record.listenedAt === "string" && record.listenedAt.trim()
          ? record.listenedAt.trim()
          : "";
      const dayKey =
        typeof record.dayKey === "string" && record.dayKey.trim() ? record.dayKey.trim() : "";

      if (!trackId || !listenedAt || !dayKey) {
        return null;
      }

      const id =
        typeof record.id === "string" && record.id.trim()
          ? record.id.trim()
          : `${trackId}:${dayKey}`;

      return {
        id,
        trackId,
        listenedAt,
        dayKey,
      } satisfies ListenHistoryEntry;
    })
    .filter((entry): entry is ListenHistoryEntry => !!entry);

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

function normalizeRecentSearches(payload: unknown): RecentSearch[] {
  const normalized = extractArrayPayload(payload)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      const query = typeof record.query === "string" ? record.query.trim() : "";
      if (!query) {
        return null;
      }

      const createdAt =
        typeof record.createdAt === "string" && !Number.isNaN(Date.parse(record.createdAt))
          ? new Date(record.createdAt).toISOString()
          : new Date().toISOString();
      const id =
        typeof record.id === "string" && record.id.trim()
          ? record.id.trim()
          : `${query}:${createdAt}`;

      return {
        id,
        query,
        createdAt,
      } satisfies RecentSearch;
    })
    .filter((entry): entry is RecentSearch => !!entry);

  const deduped = new Map<string, RecentSearch>();

  normalized.forEach((entry) => {
    const key = entry.query.toLowerCase();
    const existing = deduped.get(key);

    if (!existing || Date.parse(entry.createdAt) > Date.parse(existing.createdAt)) {
      deduped.set(key, entry);
    }
  });

  return [...deduped.values()]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 8);
}

function mergeRecentSearches(...groups: RecentSearch[][]) {
  return normalizeRecentSearches(
    groups.flatMap((entries) =>
      entries.map((entry) => ({
        id: entry.id,
        query: entry.query,
        createdAt: entry.createdAt,
      })),
    ),
  );
}

function updateTrackFavorites(favoriteIds: string[]) {
  const favoriteSet = new Set(favoriteIds);
  const state = useAppStore.getState();
  const nextTracks = Object.fromEntries(
    Object.entries(state.tracks).map(([trackId, track]) => [
      trackId,
      {
        ...track,
        isFavorite: favoriteSet.has(trackId),
      },
    ]),
  );
  const nextDownloadedTracks = Object.fromEntries(
    Object.entries(state.downloadedTracks).map(([trackId, track]) => [
      trackId,
      {
        ...track,
        isFavorite: favoriteSet.has(trackId),
      },
    ]),
  );

  useAppStore.setState({ tracks: nextTracks, downloadedTracks: nextDownloadedTracks });
}

function getKnownTracksByIds(trackIds: string[]) {
  const state = useAppStore.getState();
  const trackMap = {
    ...state.tracks,
    ...state.downloadedTracks,
  };

  return [...new Set(trackIds.filter(Boolean))]
    .map((trackId) => trackMap[trackId])
    .filter((track): track is Track => !!track);
}

async function ensureTracksSyncedForIds(trackIds: string[]) {
  const tracks = getKnownTracksByIds(trackIds);

  if (!tracks.length) {
    return;
  }

  await serverTrackCatalogService.syncTracks(tracks);
}

async function requestOptional<T>(endpoints: string[], options: ApiRequestOptions = {}) {
  for (const endpoint of endpoints) {
    try {
      return await apiClient.request<T>(endpoint, options);
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        (error.status === 404 || error.status === 405 || error.status === 501)
      ) {
        continue;
      }

      throw error;
    }
  }

  return undefined;
}

async function writeOptional(
  endpoints: string[],
  options: Omit<ApiRequestOptions, "auth">,
) {
  for (const endpoint of endpoints) {
    try {
      await apiClient.request(endpoint, { ...options, auth: true });
      return;
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        (error.status === 404 || error.status === 405 || error.status === 501)
      ) {
        continue;
      }

      throw error;
    }
  }
}

async function runQueuedSync<T>(
  state: {
    pending: T | null;
    inFlight: Promise<void> | null;
    retryTimer: ReturnType<typeof setTimeout> | null;
  },
  push: (snapshot: T) => Promise<void>,
  label: string,
) {
  if (state.retryTimer) {
    clearTimeout(state.retryTimer);
    state.retryTimer = null;
  }

  if (state.inFlight) {
    return state.inFlight;
  }

  state.inFlight = (async () => {
    if (!realtimeSyncEnabled || suppressedRealtimeSyncDepth > 0) {
      state.pending = null;
      return;
    }

    try {
      while (state.pending !== null) {
        const snapshot = state.pending;
        state.pending = null;

        try {
          await push(snapshot);
        } catch (error) {
          if (state.pending === null) {
            state.pending = snapshot;
          }

          throw error;
        }
      }
    } catch (error) {
      console.error(`[sync] Failed to push ${label}`, { error });
      state.retryTimer = setTimeout(() => {
        state.retryTimer = null;
        if (state.pending !== null && realtimeSyncEnabled && suppressedRealtimeSyncDepth === 0) {
          void runQueuedSync(state, push, label);
        }
      }, 3000);
    } finally {
      state.inFlight = null;

      if (
        state.pending !== null &&
        realtimeSyncEnabled &&
        suppressedRealtimeSyncDepth === 0 &&
        !state.retryTimer
      ) {
        void runQueuedSync(state, push, label);
      }
    }
  })();

  return state.inFlight;
}

async function withRealtimeSyncSuppressed<T>(action: () => Promise<T> | T) {
  suppressedRealtimeSyncDepth += 1;

  try {
    return await action();
  } finally {
    suppressedRealtimeSyncDepth = Math.max(0, suppressedRealtimeSyncDepth - 1);
  }
}

export const syncService = {
  enableRealtimeSync() {
    realtimeSyncEnabled = true;
  },

  disableRealtimeSync() {
    realtimeSyncEnabled = false;

    for (const state of Object.values(queuedSyncState)) {
      state.pending = null;

      if (state.retryTimer) {
        clearTimeout(state.retryTimer);
        state.retryTimer = null;
      }
    }
  },

  initializeRealtimeSync() {
    if (realtimeSyncInitialized) {
      return;
    }

    realtimeSyncInitialized = true;

    let previousFavorites = useAppStore.getState().favorites;
    let previousHistory = useAppStore.getState().listenHistory;
    let previousRecentSearches = useAppStore.getState().recentSearches;

    useAppStore.subscribe((state) => {
      const { favorites, listenHistory, recentSearches } = state;

      if (realtimeSyncEnabled && suppressedRealtimeSyncDepth === 0) {
        if (favorites !== previousFavorites) {
          void this.queueFavoritesPush(favorites);
        }

        if (listenHistory !== previousHistory) {
          void this.queueHistoryPush(listenHistory);
        }

        if (recentSearches !== previousRecentSearches) {
          void this.queueSearchHistoryPush(recentSearches);
        }
      }

      previousFavorites = favorites;
      previousHistory = listenHistory;
      previousRecentSearches = recentSearches;
    });
  },

  async pullFavorites() {
    const payload = await requestOptional<unknown>(FAVORITES_PULL_ENDPOINTS, {
      auth: true,
    });

    return {
      favoriteIds: normalizeFavorites(payload),
      tracks: normalizeFavoriteTracks(payload),
    } satisfies FavoritesSyncState;
  },

  async pushFavorites(favorites: string[]) {
    await ensureTracksSyncedForIds(favorites);
    await writeOptional(FAVORITES_PUSH_ENDPOINTS, {
      method: "PUT",
      body: { trackIds: favorites },
      keepalive: true,
      parseAs: "void",
    });
  },

  async pullHistory() {
    const payload = await requestOptional<unknown>(HISTORY_PULL_ENDPOINTS, {
      auth: true,
    });

    return normalizeHistory(payload);
  },

  async pushHistory(historyPayload: ListenHistoryEntry[]) {
    await ensureTracksSyncedForIds(historyPayload.map((entry) => entry.trackId));
    await writeOptional(HISTORY_PUSH_ENDPOINTS, {
      method: "PUT",
      body: { entries: historyPayload },
      keepalive: true,
      parseAs: "void",
    });
  },

  async pullSearchHistory() {
    const payload = await requestOptional<unknown>(SEARCH_HISTORY_PULL_ENDPOINTS, {
      auth: true,
    });

    return normalizeRecentSearches(payload);
  },

  async pushSearchHistory(searchHistory: RecentSearch[]) {
    await writeOptional(SEARCH_HISTORY_PUSH_ENDPOINTS, {
      method: "PUT",
      body: {
        items: searchHistory.map((entry) => ({
          id: entry.id,
          query: entry.query,
          createdAt: entry.createdAt,
        })),
      },
      keepalive: true,
      parseAs: "void",
    });
  },

  async syncAfterLogin() {
    const localState = useAppStore.getState();
    const [remoteFavoritesState, remoteHistory, remoteSearchHistory] = await Promise.all([
      this.pullFavorites(),
      this.pullHistory(),
      this.pullSearchHistory(),
    ]);
    const mergedFavorites = [...new Set([...localState.favorites, ...remoteFavoritesState.favoriteIds])];
    const mergedHistory = normalizeHistory([...localState.listenHistory, ...remoteHistory]);
    const mergedSearchHistory = mergeRecentSearches(localState.recentSearches, remoteSearchHistory);

    await ensureTracksSyncedForIds([
      ...mergedFavorites,
      ...mergedHistory.map((entry) => entry.trackId),
    ]);
    await Promise.all([
      this.pushFavorites(mergedFavorites),
      this.pushHistory(mergedHistory),
      this.pushSearchHistory(mergedSearchHistory),
    ]);

    await withRealtimeSyncSuppressed(() => {
      useAppStore.setState({
        favorites: mergedFavorites,
        listenHistory: mergedHistory,
        recentSearches: mergedSearchHistory,
      });

      if (remoteFavoritesState.tracks.length) {
        useAppStore.getState().hydrateCatalog(remoteFavoritesState.tracks);
      }

      updateTrackFavorites(mergedFavorites);
    });

    await downloadService.restoreMissingFavoriteDownloads(mergedFavorites);
    this.enableRealtimeSync();

    return {
      status: "synced",
      merged: true,
      conflictNames: [],
    } satisfies SyncResult;
  },

  queueFavoritesPush(favorites: string[]) {
    queuedSyncState.favorites.pending = [...favorites];
    return runQueuedSync(
      queuedSyncState.favorites,
      (snapshot) => this.pushFavorites(snapshot),
      "favorites",
    );
  },

  queueHistoryPush(history: ListenHistoryEntry[]) {
    queuedSyncState.history.pending = history.map((entry) => ({ ...entry }));
    return runQueuedSync(
      queuedSyncState.history,
      (snapshot) => this.pushHistory(snapshot),
      "history",
    );
  },

  queueSearchHistoryPush(searchHistory: RecentSearch[]) {
    queuedSyncState.searchHistory.pending = searchHistory.map((entry) => ({ ...entry }));
    return runQueuedSync(
      queuedSyncState.searchHistory,
      (snapshot) => this.pushSearchHistory(snapshot),
      "search-history",
    );
  },
};
