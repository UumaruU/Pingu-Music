"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAppStore = void 0;
const zustand_1 = require("zustand");
const middleware_1 = require("zustand/middleware");
const canonicalizationConfig_1 = require("../config/canonicalizationConfig");
const coverUrlService_1 = require("../services/coverUrlService");
const artistMetadata_1 = require("../utils/artistMetadata");
const trackIdentity_1 = require("../core/tracks/trackIdentity");
const defaultPlayerSettings = {
    volume: 0.75,
    muted: false,
    repeatMode: "off",
    shuffleEnabled: false,
};
const LISTEN_HISTORY_TTL_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const LISTEN_HISTORY_TTL_MS = LISTEN_HISTORY_TTL_DAYS * DAY_MS;
function getDayKey(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function sanitizeAndFilterListenHistory(history, nowTimestamp = Date.now()) {
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
        };
    })
        .filter((entry) => !!entry)
        .filter((entry) => nowTimestamp - Date.parse(entry.listenedAt) <= LISTEN_HISTORY_TTL_MS);
    const deduped = new Map();
    normalized.forEach((entry) => {
        const existing = deduped.get(entry.id);
        if (!existing || Date.parse(entry.listenedAt) > Date.parse(existing.listenedAt)) {
            deduped.set(entry.id, entry);
        }
    });
    return [...deduped.values()].sort((left, right) => Date.parse(right.listenedAt) - Date.parse(left.listenedAt));
}
function getPersistedTrackIds(state) {
    const trackIds = new Set();
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
function pickTracksForPersistence(tracks, trackIds) {
    if (!tracks || !trackIds.size) {
        return {};
    }
    return Object.fromEntries(Object.entries(tracks)
        .filter(([trackId]) => trackIds.has(trackId))
        .map(([trackId, track]) => [trackId, (0, trackIdentity_1.withTrackProviderDefaults)(track)]));
}
function mergeTrack(existingTrack, nextTrack, favoriteTrackIds) {
    const normalizedNextTrack = (0, trackIdentity_1.withTrackProviderDefaults)(nextTrack);
    const normalizedExistingTrack = existingTrack
        ? (0, trackIdentity_1.withTrackProviderDefaults)(existingTrack)
        : undefined;
    const isFavorite = favoriteTrackIds
        ? favoriteTrackIds.has(normalizedNextTrack.id)
        : normalizedExistingTrack?.isFavorite ?? normalizedNextTrack.isFavorite;
    const metadataTrack = normalizedExistingTrack && normalizedExistingTrack.metadataStatus !== "raw"
        ? normalizedExistingTrack
        : normalizedNextTrack;
    return {
        ...normalizedNextTrack,
        coverUrl: (0, coverUrlService_1.pickBestCoverUrl)(normalizedExistingTrack?.coverUrl, metadataTrack.coverUrl, normalizedNextTrack.coverUrl) ||
            metadataTrack.coverUrl ||
            normalizedNextTrack.coverUrl,
        isFavorite,
        downloadState: isFavorite
            ? normalizedExistingTrack?.downloadState ?? normalizedNextTrack.downloadState
            : "idle",
        localPath: isFavorite
            ? normalizedExistingTrack?.localPath ?? normalizedNextTrack.localPath
            : undefined,
        downloadError: isFavorite
            ? normalizedExistingTrack?.downloadError ?? normalizedNextTrack.downloadError
            : undefined,
        musicBrainzRecordingId: normalizedExistingTrack?.musicBrainzRecordingId ??
            normalizedNextTrack.musicBrainzRecordingId,
        musicBrainzArtistId: normalizedExistingTrack?.musicBrainzArtistId ?? normalizedNextTrack.musicBrainzArtistId,
        musicBrainzReleaseId: normalizedExistingTrack?.musicBrainzReleaseId ?? normalizedNextTrack.musicBrainzReleaseId,
        musicBrainzReleaseGroupId: normalizedExistingTrack?.musicBrainzReleaseGroupId ??
            normalizedNextTrack.musicBrainzReleaseGroupId,
        normalizedTitle: normalizedExistingTrack?.normalizedTitle ?? normalizedNextTrack.normalizedTitle,
        normalizedArtistName: normalizedExistingTrack?.normalizedArtistName ??
            normalizedNextTrack.normalizedArtistName,
        metadataStatus: normalizedExistingTrack?.metadataStatus ?? normalizedNextTrack.metadataStatus,
        albumTitle: normalizedExistingTrack?.albumTitle ?? normalizedNextTrack.albumTitle,
        releaseDate: normalizedExistingTrack?.releaseDate ?? normalizedNextTrack.releaseDate,
        explicit: normalizedExistingTrack?.explicit ?? normalizedNextTrack.explicit ?? null,
        normalizedTitleCore: normalizedExistingTrack?.normalizedTitleCore ?? normalizedNextTrack.normalizedTitleCore,
        normalizedArtistCore: normalizedExistingTrack?.normalizedArtistCore ?? normalizedNextTrack.normalizedArtistCore,
        primaryArtist: normalizedExistingTrack?.primaryArtist ?? normalizedNextTrack.primaryArtist,
        titleFlavor: normalizedExistingTrack?.titleFlavor?.length
            ? normalizedExistingTrack.titleFlavor
            : normalizedNextTrack.titleFlavor,
        canonicalId: normalizedExistingTrack?.canonicalId ?? normalizedNextTrack.canonicalId,
        acoustId: normalizedExistingTrack?.acoustId ?? normalizedNextTrack.acoustId,
        fingerprintStatus: normalizedExistingTrack?.fingerprintStatus ?? normalizedNextTrack.fingerprintStatus,
        sourcePriority: normalizedExistingTrack?.sourcePriority ?? normalizedNextTrack.sourcePriority,
        sourceTrustScore: normalizedExistingTrack?.sourceTrustScore ?? normalizedNextTrack.sourceTrustScore,
    };
}
exports.useAppStore = (0, zustand_1.create)()((0, middleware_1.persist)((set, get) => ({
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
    searchVariantResultIds: [],
    searchCanonicalResultIds: [],
    searchQuery: "",
    searchSetIds: [],
    activeSearchSetId: null,
    searchCanonicalResult: null,
    canonicalTracksById: {},
    canonicalIdByVariantTrackId: {},
    variantTrackIdsByCanonicalId: {},
    canonicalAliasById: {},
    canonicalizationVersion: canonicalizationConfig_1.CANONICALIZATION_VERSION,
    canonicalizationRevision: 0,
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
            searchVariantResultIds: trackIds,
            searchStatus: status,
            searchError: error,
        });
    },
    setActiveSearchSet: (searchSetId, trackIds) => {
        set((state) => ({
            activeSearchSetId: searchSetId,
            searchSetIds: [searchSetId, ...state.searchSetIds.filter((id) => id !== searchSetId)].slice(0, 5),
            searchResultIds: trackIds,
            searchVariantResultIds: trackIds,
        }));
    },
    clearSearchCanonicalization: () => {
        set({
            activeSearchSetId: null,
            searchSetIds: [],
            searchCanonicalResult: null,
            searchCanonicalResultIds: [],
            canonicalTracksById: {},
            canonicalIdByVariantTrackId: {},
            variantTrackIdsByCanonicalId: {},
            canonicalAliasById: {},
            canonicalizationRevision: 0,
        });
    },
    setSearchCanonicalization: (result) => {
        set((state) => ({
            activeSearchSetId: result.searchSetId,
            searchSetIds: [
                result.searchSetId,
                ...state.searchSetIds.filter((searchSetId) => searchSetId !== result.searchSetId),
            ].slice(0, 5),
            searchCanonicalResult: result,
            searchCanonicalResultIds: result.searchCanonicalResultIds,
            canonicalTracksById: result.canonicalById,
            canonicalIdByVariantTrackId: result.canonicalIdByVariantTrackId,
            variantTrackIdsByCanonicalId: result.variantTrackIdsByCanonicalId,
            canonicalAliasById: {
                ...state.canonicalAliasById,
                ...result.aliasTargetsByCanonicalId,
            },
            canonicalizationVersion: result.canonicalizationVersion,
            canonicalizationRevision: result.canonicalizationRevision,
            tracks: Object.fromEntries(Object.entries(state.tracks).map(([trackId, track]) => [
                trackId,
                result.canonicalIdByVariantTrackId[trackId]
                    ? {
                        ...track,
                        canonicalId: result.canonicalIdByVariantTrackId[trackId],
                    }
                    : track,
            ])),
            downloadedTracks: Object.fromEntries(Object.entries(state.downloadedTracks).map(([trackId, track]) => [
                trackId,
                result.canonicalIdByVariantTrackId[trackId]
                    ? {
                        ...track,
                        canonicalId: result.canonicalIdByVariantTrackId[trackId],
                    }
                    : track,
            ])),
        }));
    },
    addRecentSearch: (query) => {
        const normalized = query.trim();
        if (!normalized) {
            return;
        }
        set((state) => {
            const nextSearch = {
                id: `${Date.now()}`,
                query: normalized,
                createdAt: new Date().toISOString(),
            };
            const deduped = state.recentSearches.filter((item) => item.query.toLowerCase() !== normalized.toLowerCase());
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
            const nextTrack = {
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
            }
            else {
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
            const nextDownloadedTracks = {};
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
                const restoredTrack = snapshot
                    ? {
                        ...(0, trackIdentity_1.withTrackProviderDefaults)(snapshot),
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
                ...Object.fromEntries(artists.map((artist) => [artist.id, (0, artistMetadata_1.mergeArtistMetadata)(state.artists[artist.id], artist)])),
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
            playlists: state.playlists.map((playlist) => playlist.id === playlistId && !playlist.trackIds.includes(trackId)
                ? { ...playlist, trackIds: [...playlist.trackIds, trackId] }
                : playlist),
        }));
    },
    removeTrackFromPlaylist: (playlistId, trackId) => {
        set((state) => ({
            playlists: state.playlists.map((playlist) => playlist.id === playlistId
                ? {
                    ...playlist,
                    trackIds: playlist.trackIds.filter((id) => id !== trackId),
                }
                : playlist),
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
    syncQueue: (queueIds, originalQueueIds) => {
        set((state) => {
            const currentTrackIndex = state.currentTrackId
                ? queueIds.findIndex((trackId) => trackId === state.currentTrackId)
                : -1;
            return {
                currentQueue: queueIds,
                originalQueue: originalQueueIds ?? queueIds,
                currentTrackIndex,
                currentTrackId: currentTrackIndex >= 0 ? state.currentTrackId : queueIds[0] ?? state.currentTrackId,
            };
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
    setVolume: (volume) => set((state) => ({ playerSettings: { ...state.playerSettings, volume } })),
    setMuted: (muted) => set((state) => ({ playerSettings: { ...state.playerSettings, muted } })),
    setRepeatMode: (repeatMode) => set((state) => ({ playerSettings: { ...state.playerSettings, repeatMode } })),
    setShuffleEnabled: (shuffleEnabled) => set((state) => ({ playerSettings: { ...state.playerSettings, shuffleEnabled } })),
    setDetailsTrackId: (trackId) => set({ detailsTrackId: trackId }),
    restoreQueue: (queueIds, currentTrackId, progress) => {
        const currentTrackIndex = currentTrackId === null ? -1 : queueIds.findIndex((trackId) => trackId === currentTrackId);
        set({
            currentQueue: queueIds,
            originalQueue: queueIds,
            currentTrackIndex,
            currentTrackId,
            progress,
        });
    },
}), {
    name: "app-state",
    version: 11,
    storage: (0, middleware_1.createJSONStorage)(() => localStorage),
    migrate: (persistedState) => {
        const state = persistedState;
        if (!state) {
            return persistedState;
        }
        const favorites = Array.isArray(state.favorites) ? state.favorites : [];
        const playlists = Array.isArray(state.playlists) ? state.playlists : [];
        const currentQueue = Array.isArray(state.currentQueue) ? state.currentQueue : [];
        const originalQueue = Array.isArray(state.originalQueue)
            ? state.originalQueue
            : currentQueue;
        const downloadedTracks = state.downloadedTracks && typeof state.downloadedTracks === "object"
            ? Object.fromEntries(Object.entries(state.downloadedTracks).map(([trackId, track]) => [
                trackId,
                (0, trackIdentity_1.withTrackProviderDefaults)(track),
            ]))
            : {};
        const currentTrackId = typeof state.currentTrackId === "string" ? state.currentTrackId : null;
        const listenHistory = sanitizeAndFilterListenHistory(state.listenHistory);
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
            tracks: pickTracksForPersistence(state.tracks, persistedTrackIds),
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
            searchVariantResultIds: [],
            searchCanonicalResultIds: [],
            searchSetIds: [],
            activeSearchSetId: null,
            searchCanonicalResult: null,
            canonicalTracksById: {},
            canonicalIdByVariantTrackId: {},
            variantTrackIdsByCanonicalId: {},
            canonicalAliasById: {},
            canonicalizationVersion: canonicalizationConfig_1.CANONICALIZATION_VERSION,
            canonicalizationRevision: 0,
            searchStatus: "idle",
            searchError: null,
            recentSearches: Array.isArray(state.recentSearches) ? state.recentSearches : [],
            listenHistory,
            favorites,
            playlists,
            currentQueue,
            originalQueue,
            currentTrackIndex: typeof state.currentTrackIndex === "number" ? state.currentTrackIndex : -1,
            currentTrackId,
            isPlaying: false,
            progress: typeof state.progress === "number" ? state.progress : 0,
            duration: 0,
            detailsTrackId: null,
            playerSettings: state.playerSettings ?? defaultPlayerSettings,
            searchQuery: typeof state.searchQuery === "string" ? state.searchQuery : "",
        };
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
}));
