import { ApiClientError, ApiRequestOptions, apiClient } from "./apiClient";
import { useAppStore } from "../store/appStore";
import { PlayerSettings, Playlist, RepeatMode, SyncStatus } from "../types";

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

function normalizePlaylistName(name: string) {
  return name.trim().toLocaleLowerCase("ru-RU");
}

function unionTrackIds(primary: string[], secondary: string[]) {
  return [...new Set([...primary, ...secondary])];
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

  useAppStore.setState({ tracks: nextTracks });
}

export const syncService = {
  mergeFavorites(localFavorites: string[], remoteFavorites: string[]) {
    return [...new Set([...localFavorites, ...remoteFavorites])];
  },

  mergePlaylists(localPlaylists: Playlist[], remotePlaylists: Playlist[]) {
    const result = remotePlaylists.map((playlist) => ({
      ...playlist,
      trackIds: dedupeTrackIds(playlist.trackIds),
    }));
    const byName = new Map<string, number>();
    const conflictNames: string[] = [];
    const localConflicts: Playlist[] = [];

    result.forEach((playlist, index) => {
      byName.set(normalizePlaylistName(playlist.name), index);
    });

    localPlaylists.forEach((localPlaylist) => {
      const normalizedName = normalizePlaylistName(localPlaylist.name);
      const remoteIndex = byName.get(normalizedName);
      const localTrackIds = dedupeTrackIds(localPlaylist.trackIds);

      if (remoteIndex === undefined) {
        result.push({
          ...localPlaylist,
          trackIds: localTrackIds,
        });
        byName.set(normalizedName, result.length - 1);
        return;
      }

      const remotePlaylist = result[remoteIndex];
      const mergedTrackIds = unionTrackIds(remotePlaylist.trackIds, localTrackIds);
      const hasRealConflict =
        remotePlaylist.trackIds.length > 0 &&
        localTrackIds.length > 0 &&
        remotePlaylist.trackIds.some((trackId) => !localTrackIds.includes(trackId));

      result[remoteIndex] = {
        ...remotePlaylist,
        trackIds: mergedTrackIds,
      };

      if (hasRealConflict) {
        conflictNames.push(localPlaylist.name);
        localConflicts.push({
          ...localPlaylist,
          id: crypto.randomUUID(),
          name: `${localPlaylist.name} (локальный)`,
          trackIds: localTrackIds,
          createdAt: new Date().toISOString(),
        });
      }
    });

    return {
      playlists: [...result, ...localConflicts],
      conflictNames,
    };
  },

  mergeSettings(localSettings: PlayerSettings, remoteSettings: Partial<PlayerSettings>) {
    return {
      ...remoteSettings,
      ...localSettings,
    };
  },

  async pullHistory() {
    const payload = await requestOptional<unknown>(HISTORY_PULL_ENDPOINTS, {
      auth: true,
    });
    return extractArrayPayload(payload);
  },

  async pushHistory(historyPayload: unknown) {
    await writeOptional(HISTORY_PUSH_ENDPOINTS, {
      method: "PUT",
      body: { entries: historyPayload },
      parseAs: "void",
    });
  },

  async syncAfterLogin() {
    const localState = useAppStore.getState();
    const [remoteFavorites, remotePlaylists, remoteSettings] = await Promise.all([
      this.pullFavorites().catch(() => []),
      this.pullPlaylists().catch(() => []),
      this.pullSettings().catch(() => ({})),
    ]);

    const hasLocalData = localState.favorites.length > 0 || localState.playlists.length > 0;
    const hasRemoteData =
      remoteFavorites.length > 0 ||
      remotePlaylists.length > 0 ||
      Object.keys(remoteSettings).length > 0;
    const shouldPromptMerge = hasLocalData && hasRemoteData;

    if (shouldPromptMerge && typeof window !== "undefined") {
      const shouldMerge = window.confirm(
        "Найдены локальные и облачные данные. Объединить их сейчас?",
      );

      if (!shouldMerge) {
        return {
          status: "synced",
          merged: false,
          conflictNames: [],
        } satisfies SyncResult;
      }
    }

    const mergedFavorites = this.mergeFavorites(localState.favorites, remoteFavorites);
    const mergedPlaylists = this.mergePlaylists(localState.playlists, remotePlaylists);
    const mergedSettings = this.mergeSettings(localState.playerSettings, remoteSettings);

    useAppStore.setState({
      favorites: mergedFavorites,
      playlists: mergedPlaylists.playlists,
      playerSettings: mergedSettings,
    });
    updateTrackFavorites(mergedFavorites);

    await Promise.allSettled([
      this.pushFavorites(mergedFavorites),
      this.pushPlaylists(mergedPlaylists.playlists),
      this.pushSettings(mergedSettings),
      this.pullHistory(),
    ]);

    return {
      status: "synced",
      merged: true,
      conflictNames: mergedPlaylists.conflictNames,
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
      parseAs: "void",
    });
  },
};

