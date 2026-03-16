"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildExplanation = buildExplanation;
// Pure domain logic: explainability payload is deterministic for a fixed ranking order.
function buildExplanation(params) {
    const track = params.candidate.__track;
    const relevantArtists = track.canonicalArtistIds
        .map((artistId) => params.snapshot.artistsById[artistId]?.name)
        .filter((value) => !!value)
        .sort((left, right) => left.localeCompare(right));
    const relevantTags = track.tagIds
        .map((tagId) => params.snapshot.tagsById[tagId]?.displayName ?? tagId)
        .sort((left, right) => left.localeCompare(right));
    const topReasons = [
        ...params.candidate.sourceChannels.map((channel) => `channel:${channel}`),
        track.primaryCanonicalArtistId ? `artist:${params.snapshot.artistsById[track.primaryCanonicalArtistId]?.name ?? track.primaryCanonicalArtistId}` : null,
        track.canonicalReleaseId ? `release:${params.snapshot.releasesById[track.canonicalReleaseId]?.title ?? track.canonicalReleaseId}` : null,
        relevantTags[0] ? `tag:${relevantTags[0]}` : null,
    ].filter((value) => !!value);
    return {
        canonicalTrackId: track.canonicalTrackId,
        preferredVariantId: track.preferredVariantId ?? "",
        sourceChannels: params.candidate.sourceChannels,
        scoreBreakdown: params.candidate.scoreBreakdown,
        topReasons,
        penaltiesApplied: params.candidate.penaltiesApplied,
        suppressedCompetitors: params.suppressedCompetitors,
        relevantTags,
        relevantArtists,
    };
}
