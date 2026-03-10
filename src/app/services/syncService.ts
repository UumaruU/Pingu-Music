import { ApiClientError, ApiRequestOptions, apiClient } from "./apiClient";
import { useAppStore } from "../store/appStore";
import { ListenHistoryEntry, PlayerSettings, Playlist, RepeatMode, SyncStatus } from "../types";

interface SyncResult {
  status: SyncStatus;
  merged: boolean;
  conflictNames: string[];
}

const FAVORITES_PULL_ENDPOINTS = ["/sync/favorites"];
const FAVORITES_PUSH_ENDPOINTS = ["/sync/favorites"];
const PLAYLISTS_PULL_ENDPOINTS = ["/sync/playlists"];
const PLAYLISTS_PUSH_ENDPOINTS = ["/sync/playlists"];
const SETTINGS_PULL_ENDPOINTS = ["/sync/settings"];
const SETTINGS_PUSH_ENDPOINTS = ["/sync/settings"];
const HISTORY_PULL_ENDPOINTS = ["/sync/history"];
const HISTORY_PUSH_ENDPOINTS = ["/sync/history"];

const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  volume: 0.75,
  muted: false,
  repeatMode: "off",
  shuffleEnabled: false,
};

let realtimeSyncInitialized = false;
let realtimeSyncEnabled = false;
let suppressedRealtimeSyncDepth = 0;

const queuedSyncState = {
  favorites: {
    pending: null as string[] | null,
    inFlight: null as Promise<void> | null,
    retryTimer: null as ReturnType<typeof setTimeout> | null,
  },
  playlists: {
    pending: null as Playlist[] | null,
    inFlight: null as Promise<void> | null,
    retryTimer: null as ReturnType<typeof setTimeout> | null,
  },
  settings: {
    pending: null as Partial<PlayerSettings> | null,
    inFlight: null as Promise<void> | null,
    retryTimer: null as ReturnType<typeof setTimeout> | null,
  },
  history: {
    pending: null as ListenHistoryEntry[] | null,
    inFlight: null as Promise<void> | null,
    retryTimer: null as ReturnType<typeof setTimeout> | null,
  },
};

function dedupeTrackIds(trackIds: string[] | undefined) {
  if (!Array.isArray(trackIds)) {
    return [];
  }

  return [...new Set(trackIds.filter((trackId) => typeof trackId === "string" && trackId.trim()))];
}

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

  if (Array.isArray(record.playlists)) {
    return record.playlists;
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

function normalizePlaylists(payload: unknown) {
  const now = new Date().toISOString();

  return extractArrayPayload(payload)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      const name = typeof record.name === "string" ? record.name.trim() : "";
      if (!name) {
        return null;
      }

      const id = typeof record.id === "string" && record.id.trim()
        ? record.id.trim()
        : crypto.randomUUID();

      return {
        id,
        name,
        trackIds: dedupeTrackIds(
          Array.isArray(record.trackIds) ? (record.trackIds as string[]) : [],
        ),
        createdAt:
          typeof record.createdAt === "string" && record.createdAt.trim()
            ? record.createdAt
            : now,
      } satisfies Playlist;
    })
    .filter((playlist): playlist is Playlist => !!playlist);
}

function normalizeSettings(payload: unknown): Partial<PlayerSettings> {
  const source = asRecord(payload)?.settings ?? payload;
  const record = asRecord(source);

  if (!record) {
    return {};
  }

  const nextSettings: Partial<PlayerSettings> = {};
  if (typeof record.volume === "number" && Number.isFinite(record.volume)) {
    nextSettings.volume = Math.max(0, Math.min(1, record.volume));
  }
  if (typeof record.muted === "boolean") {
    nextSettings.muted = record.muted;
  }
  if (
    record.repeatMode === "off" ||
    record.repeatMode === "one" ||
    record.repeatMode === "all"
  ) {
    nextSettings.repeatMode = record.repeatMode as RepeatMode;
  }
  if (typeof record.shuffleEnabled === "boolean") {
    nextSettings.shuffleEnabled = record.shuffleEnabled;
  }

  return nextSettings;
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

      const id = typeof record.id === "string" && record.id.trim()
        ? record.id.trim()
        : `${trackId}:${dayKey}`;

      return {
        id: `${trackId}:${dayKey}`,
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
    let previousPlaylists = useAppStore.getState().playlists;
    let previousSettings = useAppStore.getState().playerSettings;
    let previousHistory = useAppStore.getState().listenHistory;

    useAppStore.subscribe((state) => {
      const { favorites, playlists, playerSettings, listenHistory } = state;

      if (realtimeSyncEnabled && suppressedRealtimeSyncDepth === 0) {
        if (favorites !== previousFavorites) {
          void this.queueFavoritesPush(favorites);
        }

        if (playlists !== previousPlaylists) {
          void this.queuePlaylistsPush(playlists);
        }

        if (playerSettings !== previousSettings) {
          void this.queueSettingsPush(playerSettings);
        }

        if (listenHistory !== previousHistory) {
          void this.queueHistoryPush(listenHistory);
        }
      }

      previousFavorites = favorites;
      previousPlaylists = playlists;
      previousSettings = playerSettings;
      previousHistory = listenHistory;
    });
  },

  async pullHistory() {
    const payload = await requestOptional<unknown>(HISTORY_PULL_ENDPOINTS, {
      auth: true,
    });
    return normalizeHistory(payload);
  },

  async pushHistory(historyPayload: ListenHistoryEntry[]) {
    await writeOptional(HISTORY_PUSH_ENDPOINTS, {
      method: "PUT",
      body: { entries: historyPayload },
      keepalive: true,
      parseAs: "void",
    });
  },

  async syncAfterLogin() {
    const [remoteFavorites, remotePlaylists, remoteSettings, remoteHistory] = await Promise.all([
      this.pullFavorites(),
      this.pullPlaylists(),
      this.pullSettings(),
      this.pullHistory(),
    ]);

    const nextSettings: PlayerSettings = {
      ...DEFAULT_PLAYER_SETTINGS,
      ...remoteSettings,
    };

    await withRealtimeSyncSuppressed(() => {
      useAppStore.setState({
        favorites: remoteFavorites,
        playlists: remotePlaylists,
        playerSettings: nextSettings,
        listenHistory: remoteHistory,
      });
      updateTrackFavorites(remoteFavorites);
    });
    this.enableRealtimeSync();

    return {
      status: "synced",
      merged: false,
      conflictNames: [],
    } satisfies SyncResult;
  },

  async pullFavorites() {
    const payload = await requestOptional<unknown>(FAVORITES_PULL_ENDPOINTS, {
      auth: true,
    });

    return normalizeFavorites(payload);
  },

  async pushFavorites(favorites: string[]) {
    await writeOptional(FAVORITES_PUSH_ENDPOINTS, {
      method: "PUT",
      body: { trackIds: favorites },
      keepalive: true,
      parseAs: "void",
    });
  },

  async pullPlaylists() {
    const payload = await requestOptional<unknown>(PLAYLISTS_PULL_ENDPOINTS, {
      auth: true,
    });

    return normalizePlaylists(payload);
  },

  async pushPlaylists(playlists: Playlist[]) {
    await writeOptional(PLAYLISTS_PUSH_ENDPOINTS, {
      method: "PUT",
      body: { playlists },
      keepalive: true,
      parseAs: "void",
    });
  },

  async pullSettings() {
    const payload = await requestOptional<unknown>(SETTINGS_PULL_ENDPOINTS, {
      auth: true,
    });

    return normalizeSettings(payload);
  },

  async pushSettings(settings: Partial<PlayerSettings>) {
    await writeOptional(SETTINGS_PUSH_ENDPOINTS, {
      method: "PUT",
      body: { settings },
      keepalive: true,
      parseAs: "void",
    });
  },

  queueFavoritesPush(favorites: string[]) {
    queuedSyncState.favorites.pending = [...favorites];
    return runQueuedSync(
      queuedSyncState.favorites,
      (snapshot) => this.pushFavorites(snapshot),
      "favorites",
    );
  },

  queuePlaylistsPush(playlists: Playlist[]) {
    queuedSyncState.playlists.pending = playlists.map((playlist) => ({
      ...playlist,
      trackIds: [...playlist.trackIds],
    }));
    return runQueuedSync(
      queuedSyncState.playlists,
      (snapshot) => this.pushPlaylists(snapshot),
      "playlists",
    );
  },

  queueSettingsPush(settings: Partial<PlayerSettings>) {
    queuedSyncState.settings.pending = { ...settings };
    return runQueuedSync(
      queuedSyncState.settings,
      (snapshot) => this.pushSettings(snapshot),
      "settings",
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
};
