"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCanonicalLyricsLookupContext = buildCanonicalLyricsLookupContext;
const canonicalizationConfig_1 = require("../config/canonicalizationConfig");
const normalizationService_1 = require("./normalizationService");
const sourceMetadataService_1 = require("./sourceMetadataService");
const trackCanonicalizationService_1 = require("./trackCanonicalizationService");
function dedupeStrings(values) {
    return [...new Set(values.filter(Boolean))];
}
function buildVariantCacheKey(trackId) {
    return `variant:${trackId}`;
}
function getMetadataCompletenessScore(track) {
    let score = 0;
    if (track.musicBrainzRecordingId) {
        score += 3;
    }
    if (track.albumTitle) {
        score += 1;
    }
    if (track.coverUrl && !/placehold/i.test(track.coverUrl)) {
        score += 1;
    }
    if (track.releaseDate) {
        score += 0.5;
    }
    if (track.explicit !== null && track.explicit !== undefined) {
        score += 0.25;
    }
    return score;
}
function buildQueryKey(title, artist, duration, config) {
    return [
        normalizationService_1.normalizationService.normalizeComparisonText(title),
        normalizationService_1.normalizationService.normalizeComparisonText(artist),
        normalizationService_1.normalizationService.getDurationBucket(duration, config.lyricsDurationBucketMs / 1000),
    ].join("|");
}
function orderClusterTracks(tracks, requestedTrackId, preferredVariantId) {
    return [...tracks].sort((left, right) => {
        const leftIsPreferred = left.id === preferredVariantId ? 1 : 0;
        const rightIsPreferred = right.id === preferredVariantId ? 1 : 0;
        if (leftIsPreferred !== rightIsPreferred) {
            return rightIsPreferred - leftIsPreferred;
        }
        const leftIsRequested = left.id === requestedTrackId ? 1 : 0;
        const rightIsRequested = right.id === requestedTrackId ? 1 : 0;
        if (leftIsRequested !== rightIsRequested) {
            return rightIsRequested - leftIsRequested;
        }
        const leftPriority = left.sourcePriority ?? (0, sourceMetadataService_1.getSourcePriority)(left.providerId);
        const rightPriority = right.sourcePriority ?? (0, sourceMetadataService_1.getSourcePriority)(right.providerId);
        if (leftPriority !== rightPriority) {
            return rightPriority - leftPriority;
        }
        const leftTrust = left.sourceTrustScore ?? (0, sourceMetadataService_1.getSourceTrustScore)(left.providerId);
        const rightTrust = right.sourceTrustScore ?? (0, sourceMetadataService_1.getSourceTrustScore)(right.providerId);
        if (leftTrust !== rightTrust) {
            return rightTrust - leftTrust;
        }
        const leftMetadata = getMetadataCompletenessScore(left);
        const rightMetadata = getMetadataCompletenessScore(right);
        if (leftMetadata !== rightMetadata) {
            return rightMetadata - leftMetadata;
        }
        return left.id.localeCompare(right.id);
    });
}
function buildVariantCandidate(track) {
    return {
        trackId: track.id,
        cacheKeys: [buildVariantCacheKey(track.id), track.id],
        lookupTitle: track.title,
        lookupArtist: track.artist,
        lookupDuration: track.duration,
        source: "variant",
    };
}
function buildCanonicalLyricsLookupContext(params) {
    const { track, canonicalTrack, variantTracks = [], config = canonicalizationConfig_1.canonicalizationConfig } = params;
    if (!canonicalTrack) {
        const lookupCandidates = [buildVariantCandidate(track)];
        return {
            canReuseCanonicalLyrics: false,
            cacheKey: buildVariantCacheKey(track.id),
            cacheKeys: lookupCandidates.flatMap((candidate) => candidate.cacheKeys),
            lookupTitle: track.normalizedTitleCore ?? track.normalizedTitle ?? track.title,
            lookupArtist: track.normalizedArtistCore ?? track.normalizedArtistName ?? track.artist,
            lookupDuration: track.duration,
            lookupCandidates,
            variantTrackIds: [track.id],
        };
    }
    const durationDeltaMs = Math.abs(track.duration - (canonicalTrack.targetDuration ?? track.duration)) * 1000;
    const hasFlavorConflict = canonicalTrack.debugInfo?.mergeBlockers?.includes("flavor_conflict") ?? false;
    const hasMbConflict = canonicalTrack.debugInfo?.mergeBlockers?.includes("conflicting_mb_recording_ids") ?? false;
    const hasEnoughConfidence = (canonicalTrack.quality?.clusterConfidence ?? 0) >= config.minCanonicalConfidenceForLyricsReuse;
    const canReuseCanonicalLyrics = !hasFlavorConflict && !hasMbConflict && durationDeltaMs <= config.maxDurationDeltaMsStrict && hasEnoughConfidence;
    const clusterTrackMap = new Map(dedupeStrings([track.id, ...canonicalTrack.variantTrackIds]).map((trackId) => [
        trackId,
        variantTracks.find((candidate) => candidate.id === trackId) ??
            (track.id === trackId ? track : null),
    ]));
    const clusterTracks = [...clusterTrackMap.values()].filter((candidate) => !!candidate);
    const orderedTracks = orderClusterTracks(clusterTracks, track.id, canonicalTrack.preferredVariantId);
    const primaryCacheKey = canReuseCanonicalLyrics
        ? `canonical:${(0, trackCanonicalizationService_1.buildCanonicalLyricsCacheKey)(canonicalTrack, config)}`
        : buildVariantCacheKey(track.id);
    const queryKeys = new Set();
    const lookupCandidates = [];
    if (canReuseCanonicalLyrics) {
        const canonicalQueryKey = buildQueryKey(canonicalTrack.title ?? track.title, canonicalTrack.artist ?? track.artist, canonicalTrack.targetDuration ?? track.duration, config);
        queryKeys.add(canonicalQueryKey);
        lookupCandidates.push({
            trackId: canonicalTrack.preferredVariantId ?? track.id,
            cacheKeys: [primaryCacheKey],
            lookupTitle: canonicalTrack.title ?? track.title,
            lookupArtist: canonicalTrack.artist ?? track.artist,
            lookupDuration: canonicalTrack.targetDuration ?? track.duration,
            source: "canonical",
        });
    }
    orderedTracks.forEach((candidateTrack) => {
        const queryKey = buildQueryKey(candidateTrack.title, candidateTrack.artist, candidateTrack.duration, config);
        if (queryKeys.has(queryKey)) {
            return;
        }
        queryKeys.add(queryKey);
        lookupCandidates.push(buildVariantCandidate(candidateTrack));
    });
    const cacheKeys = dedupeStrings([
        primaryCacheKey,
        ...lookupCandidates.flatMap((candidate) => candidate.cacheKeys),
    ]);
    return {
        canReuseCanonicalLyrics,
        cacheKey: primaryCacheKey,
        cacheKeys,
        lookupTitle: canonicalTrack.title ?? track.normalizedTitleCore ?? track.normalizedTitle ?? track.title,
        lookupArtist: canonicalTrack.artist ??
            track.normalizedArtistCore ??
            track.normalizedArtistName ??
            track.artist,
        lookupDuration: canonicalTrack.targetDuration ?? track.duration,
        lookupCandidates,
        variantTrackIds: dedupeStrings([track.id, ...orderedTracks.map((candidate) => candidate.id)]),
    };
}
