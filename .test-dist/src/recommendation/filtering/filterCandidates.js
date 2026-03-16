"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterScoredCandidates = filterScoredCandidates;
// Pure domain logic: filtering removes ineligible candidates before diversification/final selection.
function filterScoredCandidates(params) {
    return params.candidates.filter((candidate) => {
        const track = candidate.__track;
        if (!track) {
            return false;
        }
        if (params.context.currentCanonicalTrackId === candidate.canonicalTrackId) {
            return false;
        }
        if (!track.preferredVariantId || !track.playableVariantIds.includes(track.preferredVariantId)) {
            return false;
        }
        if (track.quality.clusterConfidence < params.config.filtering.minCanonicalConfidence) {
            return false;
        }
        if (params.profiles.entity.dislikedTrackIds.includes(track.canonicalTrackId)) {
            return false;
        }
        if (params.context.skippedTrackIds.includes(track.canonicalTrackId)) {
            return false;
        }
        return true;
    });
}
