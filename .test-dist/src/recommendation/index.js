"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRecommendationEngine = createRecommendationEngine;
const profileStore_1 = require("./affinity/profileStore");
const defaultRecommendationConfig_1 = require("./config/defaultRecommendationConfig");
const getNextRecommendedTrack_1 = require("./next-track/getNextRecommendedTrack");
async function enrichContext(deps, context, profiles) {
    const history = await deps.userHistoryReader.getRecentHistory();
    const favorites = await deps.favoritesReader.getFavoriteTrackIds();
    return {
        ...context,
        favoritedTrackIds: context.favoritedTrackIds.length ? context.favoritedTrackIds : favorites,
        recentTrackIds: context.recentTrackIds.length
            ? context.recentTrackIds
            : history.map((entry) => entry.trackId).filter(Boolean).slice(0, 24),
        skippedTrackIds: context.skippedTrackIds.length
            ? context.skippedTrackIds
            : profiles.session.recentSkippedTrackIds,
        recentRecommendationIds: context.recentRecommendationIds.length
            ? context.recentRecommendationIds
            : profiles.session.recentRecommendationIds,
        longTermTasteProfile: context.longTermTasteProfile ?? profiles.longTerm,
        sessionTasteProfile: context.sessionTasteProfile ?? profiles.session,
    };
}
// Future backend extraction point: only adapters in deps need replacement for server-side execution.
function createRecommendationEngine(deps, config = defaultRecommendationConfig_1.defaultRecommendationConfig) {
    return {
        async getNextRecommendedTrack(context) {
            const snapshot = await deps.catalogReader.getSnapshot();
            const profiles = await (0, profileStore_1.loadProfiles)(deps.cacheStore);
            const enrichedContext = await enrichContext(deps, context, profiles);
            const result = (0, getNextRecommendedTrack_1.getBestNextTrack)({
                seed: {
                    mode: context.mode,
                    canonicalTrackId: enrichedContext.currentCanonicalTrackId ?? undefined,
                },
                context: enrichedContext,
                snapshot,
                profiles,
                config,
            });
            await deps.resultWriter.writeTrackResult({
                context: enrichedContext,
                result,
            });
            if (result) {
                profiles.session.recentRecommendationIds = [
                    result.canonicalTrackId,
                    ...profiles.session.recentRecommendationIds.filter((id) => id !== result.canonicalTrackId),
                ].slice(0, 32);
                await (0, profileStore_1.saveProfiles)(deps.cacheStore, profiles);
            }
            return result;
        },
        async getRecommendedTracks(seed, context) {
            const snapshot = await deps.catalogReader.getSnapshot();
            const profiles = await (0, profileStore_1.loadProfiles)(deps.cacheStore);
            const enrichedContext = await enrichContext(deps, context, profiles);
            const results = (0, getNextRecommendedTrack_1.getRankedTrackRecommendations)({
                seed,
                context: enrichedContext,
                snapshot,
                profiles,
                config,
            });
            await deps.resultWriter.writeTrackRanking({
                seed,
                context: enrichedContext,
                results,
            });
            profiles.session.recentRecommendationIds = [
                ...results.map((result) => result.canonicalTrackId),
                ...profiles.session.recentRecommendationIds,
            ]
                .filter((value, index, list) => list.indexOf(value) === index)
                .slice(0, 32);
            await (0, profileStore_1.saveProfiles)(deps.cacheStore, profiles);
            return results;
        },
        async getRecommendedArtists(seed, context) {
            const snapshot = await deps.catalogReader.getSnapshot();
            const profiles = await (0, profileStore_1.loadProfiles)(deps.cacheStore);
            const enrichedContext = await enrichContext(deps, context, profiles);
            const results = (0, getNextRecommendedTrack_1.getRankedArtistRecommendations)({
                seed,
                context: enrichedContext,
                snapshot,
                profiles,
                config,
            });
            await deps.resultWriter.writeArtistRanking({
                seed,
                context: enrichedContext,
                results,
            });
            return results;
        },
        async updateAffinityFromPlayback(event) {
            const snapshot = await deps.catalogReader.getSnapshot();
            await (0, profileStore_1.updateProfilesFromPlayback)({
                cacheStore: deps.cacheStore,
                snapshot,
                config,
                event,
            });
        },
        async updateAffinityFromFavorite(event) {
            const snapshot = await deps.catalogReader.getSnapshot();
            await (0, profileStore_1.updateProfilesFromFavorite)({
                cacheStore: deps.cacheStore,
                snapshot,
                config,
                event,
            });
        },
        async updateAffinityFromPlaylist(event) {
            const snapshot = await deps.catalogReader.getSnapshot();
            await (0, profileStore_1.updateProfilesFromPlaylist)({
                cacheStore: deps.cacheStore,
                snapshot,
                config,
                event,
            });
        },
        async updateAffinityFromDislike(event) {
            const snapshot = await deps.catalogReader.getSnapshot();
            await (0, profileStore_1.updateProfilesFromDislike)({
                cacheStore: deps.cacheStore,
                snapshot,
                config,
                event,
            });
        },
    };
}
