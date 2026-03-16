"use strict";
// Frontend adapter: legacy app entrypoint for pure canonicalization logic extracted to src/recommendation.
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackCanonicalizationService = void 0;
exports.resolvePlayableTrackId = resolvePlayableTrackId;
exports.buildCanonicalLyricsCacheKey = buildCanonicalLyricsCacheKey;
const trackCanonicalization_1 = require("../../recommendation/canonical-graph/trackCanonicalization");
const canonicalizationConfig_1 = require("../config/canonicalizationConfig");
function toDomainLyricsMap(lyricsByTrackId) {
    if (!lyricsByTrackId) {
        return {};
    }
    return Object.fromEntries(Object.entries(lyricsByTrackId).map(([trackId, lyrics]) => [
        trackId,
        {
            plain: lyrics.plain,
            synced: lyrics.synced,
            status: lyrics.status,
        },
    ]));
}
function resolvePlayableTrackId(canonicalTrack) {
    return (0, trackCanonicalization_1.resolvePlayableTrackId)(canonicalTrack);
}
function buildCanonicalLyricsCacheKey(canonicalTrack, config) {
    return (0, trackCanonicalization_1.buildCanonicalLyricsCacheKey)(canonicalTrack, config);
}
exports.trackCanonicalizationService = {
    canonicalizationVersion: canonicalizationConfig_1.CANONICALIZATION_VERSION,
    buildCanonicalizationResult(input) {
        return trackCanonicalization_1.recommendationTrackCanonicalizationService.buildCanonicalizationResult({
            ...input,
            lyricsByTrackId: toDomainLyricsMap(input.lyricsByTrackId),
            tracks: input.tracks,
            previousResult: input.previousResult,
            config: (input.config ?? canonicalizationConfig_1.canonicalizationConfig),
        });
    },
};
