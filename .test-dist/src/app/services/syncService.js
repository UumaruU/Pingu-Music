"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncService = void 0;
const apiClient_1 = require("./apiClient");
const downloadService_1 = require("./downloadService");
const trackIdentity_1 = require("../core/tracks/trackIdentity");
const appStore_1 = require("../store/appStore");
const FAVORITES_PULL_ENDPOINTS = ["/sync/favorites"];
const FAVORITES_PUSH_ENDPOINTS = ["/sync/favorites"];
const PLAYLISTS_PULL_ENDPOINTS = ["/sync/playlists"];
const PLAYLISTS_PUSH_ENDPOINTS = ["/sync/playlists"];
const SETTINGS_PULL_ENDPOINTS = ["/sync/settings"];
const SETTINGS_PUSH_ENDPOINTS = ["/sync/settings"];
const HISTORY_PULL_ENDPOINTS = ["/sync/history"];
const HISTORY_PUSH_ENDPOINTS = ["/sync/history"];
const DEFAULT_PLAYER_SETTINGS = {
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
        pending: null,
        inFlight: null,
        retryTimer: null,
    },
    playlists: {
        pending: null,
        inFlight: null,
        retryTimer: null,
    },
    settings: {
        pending: null,
        inFlight: null,
        retryTimer: null,
    },
    history: {
        pending: null,
        inFlight: null,
        retryTimer: null,
    },
};
function dedupeTrackIds(trackIds) {
    if (!Array.isArray(trackIds)) {
        return [];
    }
    return [...new Set(trackIds.filter((trackId) => typeof trackId === "string" && trackId.trim()))];
}
function asRecord(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    return value;
}
function extractArrayPayload(payload) {
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
function normalizeFavorites(payload) {
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
function normalizeFavoriteTracks(payload) {
    const record = asRecord(payload);
    const rawTracks = Array.isArray(record?.tracks) ? record.tracks : [];
    const normalizedTracks = rawTracks.map((item) => {
        const track = asRecord(item);
        if (!track) {
            return null;
        }
        const id = typeof track.id === "string" && track.id.trim() ? track.id.trim() : "";
        const title = typeof track.title === "string" && track.title.trim() ? track.title.trim() : "";
        const artist = typeof track.artist === "string" && track.artist.trim() ? track.artist.trim() : "";
        const audioUrl = typeof track.audioUrl === "string" && track.audioUrl.trim() ? track.audioUrl.trim() : "";
        if (!id || !title || !artist || !audioUrl) {
            return null;
        }
        return {
            id,
            providerId: track.providerId === "hitmos" ||
                track.providerId === "lmusic" ||
                track.providerId === "soundcloud" ||
                track.providerId === "telegram"
                ? track.providerId
                : "hitmos",
            providerTrackId: typeof track.providerTrackId === "string" && track.providerTrackId.trim()
                ? track.providerTrackId.trim()
                : id.includes(":")
                    ? id.slice(id.indexOf(":") + 1)
                    : id,
            title,
            artist,
            coverUrl: typeof track.coverUrl === "string" && track.coverUrl.trim()
                ? track.coverUrl.trim()
                : "https://placehold.co/300x300?text=Pingu+Music",
            audioUrl,
            duration: typeof track.duration === "number" && Number.isFinite(track.duration)
                ? track.duration
                : 0,
            sourceUrl: typeof track.sourceUrl === "string" && track.sourceUrl.trim()
                ? track.sourceUrl.trim()
                : "https://rus.hitmotop.com",
            isFavorite: true,
            downloadState: "idle",
            metadataStatus: track.metadataStatus === "matching" ||
                track.metadataStatus === "matched" ||
                track.metadataStatus === "enriched"
                ? track.metadataStatus
                : "raw",
            albumTitle: typeof track.albumTitle === "string" && track.albumTitle.trim()
                ? track.albumTitle.trim()
                : undefined,
            musicBrainzRecordingId: typeof track.musicBrainzRecordingId === "string" && track.musicBrainzRecordingId.trim()
                ? track.musicBrainzRecordingId.trim()
                : undefined,
            musicBrainzArtistId: typeof track.musicBrainzArtistId === "string" && track.musicBrainzArtistId.trim()
                ? track.musicBrainzArtistId.trim()
                : undefined,
            musicBrainzReleaseId: typeof track.musicBrainzReleaseId === "string" && track.musicBrainzReleaseId.trim()
                ? track.musicBrainzReleaseId.trim()
                : undefined,
        };
    });
    return normalizedTracks
        .filter((track) => !!track)
        .map((track) => (0, trackIdentity_1.withTrackProviderDefaults)(track));
}
function normalizePlaylists(payload) {
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
            trackIds: dedupeTrackIds(Array.isArray(record.trackIds) ? record.trackIds : []),
            createdAt: typeof record.createdAt === "string" && record.createdAt.trim()
                ? record.createdAt
                : now,
        };
    })
        .filter((playlist) => !!playlist);
}
function normalizeSettings(payload) {
    const source = asRecord(payload)?.settings ?? payload;
    const record = asRecord(source);
    if (!record) {
        return {};
    }
    const nextSettings = {};
    if (typeof record.volume === "number" && Number.isFinite(record.volume)) {
        nextSettings.volume = Math.max(0, Math.min(1, record.volume));
    }
    if (typeof record.muted === "boolean") {
        nextSettings.muted = record.muted;
    }
    if (record.repeatMode === "off" ||
        record.repeatMode === "one" ||
        record.repeatMode === "all") {
        nextSettings.repeatMode = record.repeatMode;
    }
    if (typeof record.shuffleEnabled === "boolean") {
        nextSettings.shuffleEnabled = record.shuffleEnabled;
    }
    return nextSettings;
}
function normalizeHistory(payload) {
    const normalized = extractArrayPayload(payload)
        .map((item) => {
        const record = asRecord(item);
        if (!record) {
            return null;
        }
        const trackId = typeof record.trackId === "string" ? record.trackId.trim() : "";
        const listenedAt = typeof record.listenedAt === "string" && record.listenedAt.trim()
            ? record.listenedAt.trim()
            : "";
        const dayKey = typeof record.dayKey === "string" && record.dayKey.trim() ? record.dayKey.trim() : "";
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
        };
    })
        .filter((entry) => !!entry);
    const deduped = new Map();
    normalized.forEach((entry) => {
        const existing = deduped.get(entry.id);
        if (!existing || Date.parse(entry.listenedAt) > Date.parse(existing.listenedAt)) {
            deduped.set(entry.id, entry);
        }
    });
    return [...deduped.values()].sort((left, right) => Date.parse(right.listenedAt) - Date.parse(left.listenedAt));
}
async function requestOptional(endpoints, options = {}) {
    for (const endpoint of endpoints) {
        try {
            return await apiClient_1.apiClient.request(endpoint, options);
        }
        catch (error) {
            if (error instanceof apiClient_1.ApiClientError &&
                (error.status === 404 || error.status === 405 || error.status === 501)) {
                continue;
            }
            throw error;
        }
    }
    return undefined;
}
async function writeOptional(endpoints, options) {
    for (const endpoint of endpoints) {
        try {
            await apiClient_1.apiClient.request(endpoint, { ...options, auth: true });
            return;
        }
        catch (error) {
            if (error instanceof apiClient_1.ApiClientError &&
                (error.status === 404 || error.status === 405 || error.status === 501)) {
                continue;
            }
            throw error;
        }
    }
}
function updateTrackFavorites(favoriteIds) {
    const favoriteSet = new Set(favoriteIds);
    const state = appStore_1.useAppStore.getState();
    const nextTracks = Object.fromEntries(Object.entries(state.tracks).map(([trackId, track]) => [
        trackId,
        {
            ...track,
            isFavorite: favoriteSet.has(trackId),
        },
    ]));
    const nextDownloadedTracks = Object.fromEntries(Object.entries(state.downloadedTracks).map(([trackId, track]) => [
        trackId,
        {
            ...track,
            isFavorite: favoriteSet.has(trackId),
        },
    ]));
    appStore_1.useAppStore.setState({ tracks: nextTracks, downloadedTracks: nextDownloadedTracks });
}
async function runQueuedSync(state, push, label) {
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
                }
                catch (error) {
                    if (state.pending === null) {
                        state.pending = snapshot;
                    }
                    throw error;
                }
            }
        }
        catch (error) {
            console.error(`[sync] Failed to push ${label}`, { error });
            state.retryTimer = setTimeout(() => {
                state.retryTimer = null;
                if (state.pending !== null && realtimeSyncEnabled && suppressedRealtimeSyncDepth === 0) {
                    void runQueuedSync(state, push, label);
                }
            }, 3000);
        }
        finally {
            state.inFlight = null;
            if (state.pending !== null &&
                realtimeSyncEnabled &&
                suppressedRealtimeSyncDepth === 0 &&
                !state.retryTimer) {
                void runQueuedSync(state, push, label);
            }
        }
    })();
    return state.inFlight;
}
async function withRealtimeSyncSuppressed(action) {
    suppressedRealtimeSyncDepth += 1;
    try {
        return await action();
    }
    finally {
        suppressedRealtimeSyncDepth = Math.max(0, suppressedRealtimeSyncDepth - 1);
    }
}
exports.syncService = {
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
        let previousFavorites = appStore_1.useAppStore.getState().favorites;
        let previousPlaylists = appStore_1.useAppStore.getState().playlists;
        let previousSettings = appStore_1.useAppStore.getState().playerSettings;
        let previousHistory = appStore_1.useAppStore.getState().listenHistory;
        appStore_1.useAppStore.subscribe((state) => {
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
        const payload = await requestOptional(HISTORY_PULL_ENDPOINTS, {
            auth: true,
        });
        return normalizeHistory(payload);
    },
    async pushHistory(historyPayload) {
        await writeOptional(HISTORY_PUSH_ENDPOINTS, {
            method: "PUT",
            body: { entries: historyPayload },
            keepalive: true,
            parseAs: "void",
        });
    },
    async syncAfterLogin() {
        const [remoteFavoritesState, remotePlaylists, remoteSettings, remoteHistory] = await Promise.all([
            this.pullFavorites(),
            this.pullPlaylists(),
            this.pullSettings(),
            this.pullHistory(),
        ]);
        const remoteFavorites = remoteFavoritesState.favoriteIds;
        const nextSettings = {
            ...DEFAULT_PLAYER_SETTINGS,
            ...remoteSettings,
        };
        await withRealtimeSyncSuppressed(() => {
            appStore_1.useAppStore.setState({
                favorites: remoteFavorites,
                playlists: remotePlaylists,
                playerSettings: nextSettings,
                listenHistory: remoteHistory,
            });
            if (remoteFavoritesState.tracks.length) {
                appStore_1.useAppStore.getState().hydrateCatalog(remoteFavoritesState.tracks);
            }
            updateTrackFavorites(remoteFavorites);
        });
        await downloadService_1.downloadService.restoreMissingFavoriteDownloads(remoteFavorites);
        this.enableRealtimeSync();
        return {
            status: "synced",
            merged: false,
            conflictNames: [],
        };
    },
    async pullFavorites() {
        const payload = await requestOptional(FAVORITES_PULL_ENDPOINTS, {
            auth: true,
        });
        return {
            favoriteIds: normalizeFavorites(payload),
            tracks: normalizeFavoriteTracks(payload),
        };
    },
    async pushFavorites(favorites) {
        await writeOptional(FAVORITES_PUSH_ENDPOINTS, {
            method: "PUT",
            body: { trackIds: favorites },
            keepalive: true,
            parseAs: "void",
        });
    },
    async pullPlaylists() {
        const payload = await requestOptional(PLAYLISTS_PULL_ENDPOINTS, {
            auth: true,
        });
        return normalizePlaylists(payload);
    },
    async pushPlaylists(playlists) {
        await writeOptional(PLAYLISTS_PUSH_ENDPOINTS, {
            method: "PUT",
            body: { playlists },
            keepalive: true,
            parseAs: "void",
        });
    },
    async pullSettings() {
        const payload = await requestOptional(SETTINGS_PULL_ENDPOINTS, {
            auth: true,
        });
        return normalizeSettings(payload);
    },
    async pushSettings(settings) {
        await writeOptional(SETTINGS_PUSH_ENDPOINTS, {
            method: "PUT",
            body: { settings },
            keepalive: true,
            parseAs: "void",
        });
    },
    queueFavoritesPush(favorites) {
        queuedSyncState.favorites.pending = [...favorites];
        return runQueuedSync(queuedSyncState.favorites, (snapshot) => this.pushFavorites(snapshot), "favorites");
    },
    queuePlaylistsPush(playlists) {
        queuedSyncState.playlists.pending = playlists.map((playlist) => ({
            ...playlist,
            trackIds: [...playlist.trackIds],
        }));
        return runQueuedSync(queuedSyncState.playlists, (snapshot) => this.pushPlaylists(snapshot), "playlists");
    },
    queueSettingsPush(settings) {
        queuedSyncState.settings.pending = { ...settings };
        return runQueuedSync(queuedSyncState.settings, (snapshot) => this.pushSettings(snapshot), "settings");
    },
    queueHistoryPush(history) {
        queuedSyncState.history.pending = history.map((entry) => ({ ...entry }));
        return runQueuedSync(queuedSyncState.history, (snapshot) => this.pushHistory(snapshot), "history");
    },
};
