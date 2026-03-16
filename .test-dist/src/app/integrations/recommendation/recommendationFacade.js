"use strict";
// Frontend adapter: recommendations are computed on the authenticated backend; the UI only syncs catalog data and consumes ready-to-play tracks.
Object.defineProperty(exports, "__esModule", { value: true });
exports.recommendationFacade = void 0;
const apiClient_1 = require("../../services/apiClient");
const serverTrackCatalogService_1 = require("../../services/serverTrackCatalogService");
const appStore_1 = require("../../store/appStore");
const authStore_1 = require("../../store/authStore");
function createSessionId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `session:${crypto.randomUUID()}`;
    }
    return `session:${Date.now()}`;
}
const currentSessionId = createSessionId();
function dedupe(values) {
    return [...new Set(values.filter(Boolean))];
}
function canUseRecommendations() {
    return authStore_1.useAuthStore.getState().isAuthenticated;
}
function getTrackMap() {
    const state = appStore_1.useAppStore.getState();
    return {
        ...state.downloadedTracks,
        ...state.tracks,
    };
}
function getRecommendationRelevantTracks(extraTrackIds = []) {
    const state = appStore_1.useAppStore.getState();
    const trackMap = getTrackMap();
    const prioritizedTrackIds = dedupe([
        ...extraTrackIds,
        state.currentTrackId ?? "",
        ...state.currentQueue,
        ...state.originalQueue,
        ...state.favorites,
        ...state.listenHistory.map((entry) => entry.trackId),
        ...state.popularTrackIds,
        ...Object.keys(trackMap),
    ]);
    return prioritizedTrackIds
        .map((trackId) => trackMap[trackId])
        .filter((track) => !!track)
        .slice(0, 500);
}
async function ensureRecommendationCatalogSynced(extraTrackIds = []) {
    if (!canUseRecommendations()) {
        return;
    }
    await serverTrackCatalogService_1.serverTrackCatalogService.syncTracks(getRecommendationRelevantTracks(extraTrackIds));
}
function hydrateTracks(tracks) {
    if (!tracks.length) {
        return;
    }
    appStore_1.useAppStore.getState().hydrateCatalog(tracks);
}
function normalizeRecommendedTrack(input) {
    return {
        ...input,
        track: input.track,
    };
}
exports.recommendationFacade = {
    canUseRecommendations,
    async getNextRecommendedTrack() {
        if (!canUseRecommendations()) {
            return null;
        }
        const state = appStore_1.useAppStore.getState();
        await ensureRecommendationCatalogSynced(state.currentTrackId ? [state.currentTrackId] : []);
        const result = await apiClient_1.apiClient.request("/me/recommendations/next-track", {
            method: "POST",
            body: {
                currentTrackId: state.currentTrackId,
                mode: "autoplay",
            },
        });
        if (result?.track) {
            hydrateTracks([result.track]);
            return normalizeRecommendedTrack(result);
        }
        return null;
    },
    async getRecommendationStreamBatch(options = {}) {
        if (!canUseRecommendations()) {
            return {
                seed: {
                    mode: options.mode ?? "autoplay",
                },
                seedLabel: "требуется вход",
                items: [],
            };
        }
        await ensureRecommendationCatalogSynced(dedupe([options.seedVariantTrackId ?? "", ...appStore_1.useAppStore.getState().favorites]));
        const batch = await apiClient_1.apiClient.request("/me/recommendations/stream", {
            method: "POST",
            body: {
                limit: options.limit ?? 12,
                mode: options.mode ?? "autoplay",
                seedTrackId: options.seedVariantTrackId ?? null,
                currentTrackId: appStore_1.useAppStore.getState().currentTrackId,
                excludeTrackIds: options.excludeCanonicalTrackIds ?? [],
                recentRecommendationTrackIds: options.recentRecommendationIds ?? [],
            },
        });
        hydrateTracks(batch.items.map((item) => item.track));
        return {
            ...batch,
            items: batch.items.map(normalizeRecommendedTrack),
        };
    },
    async updatePlaybackAffinityForVariantTrack(trackId, payload) {
        if (!canUseRecommendations()) {
            return;
        }
        await ensureRecommendationCatalogSynced([trackId]);
        await apiClient_1.apiClient.request("/me/recommendations/events/playback", {
            method: "POST",
            parseAs: "void",
            body: {
                trackId,
                listenedMs: payload.listenedMs,
                trackDurationMs: payload.trackDurationMs,
                occurredAt: new Date().toISOString(),
                endedNaturally: payload.endedNaturally,
                wasSkipped: payload.wasSkipped,
                sessionId: currentSessionId,
                seedChannels: payload.seedChannels?.length
                    ? payload.seedChannels
                    : ["sessionContinuation"],
            },
        });
    },
    async updateFavoriteAffinityForVariantTrack(trackId, isFavorite) {
        if (!canUseRecommendations()) {
            return;
        }
        await ensureRecommendationCatalogSynced([trackId]);
        await apiClient_1.apiClient.request("/me/recommendations/events/favorite", {
            method: "POST",
            parseAs: "void",
            body: {
                trackId,
                occurredAt: new Date().toISOString(),
                isFavorite,
            },
        });
    },
    async updatePlaylistAffinityForVariantTrack(trackId, playlistId, isAdded) {
        if (!canUseRecommendations()) {
            return;
        }
        await ensureRecommendationCatalogSynced([trackId]);
        await apiClient_1.apiClient.request("/me/recommendations/events/playlist", {
            method: "POST",
            parseAs: "void",
            body: {
                trackId,
                playlistId,
                occurredAt: new Date().toISOString(),
                isAdded,
            },
        });
    },
};
