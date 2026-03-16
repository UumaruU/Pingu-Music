"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractArtistRelations = extractArtistRelations;
exports.buildArtistRelationGraph = buildArtistRelationGraph;
exports.inferRelationTypeFromArtistText = inferRelationTypeFromArtistText;
const FEATURE_PATTERN = /\b(?:feat|ft|featuring|with|x|&|vs|prod\. by|remix by)\b/i;
function buildPairKey(leftId, rightId) {
    return leftId < rightId ? `${leftId}::${rightId}` : `${rightId}::${leftId}`;
}
function relationWeight(relationType) {
    switch (relationType) {
        case "collaborated_with":
            return 1;
        case "featured_with":
            return 0.75;
        case "producer_for":
            return 0.5;
        case "remixer_of":
            return 0.45;
        default:
            return 0.35;
    }
}
// Pure domain logic: relation extraction only uses canonical entities and heuristics.
function extractArtistRelations(input) {
    const evidenceByPair = new Map();
    Object.values(input.tracksById).forEach((track) => {
        const primaryArtistId = track.primaryCanonicalArtistId;
        if (!primaryArtistId) {
            return;
        }
        const collaboratorIds = track.canonicalArtistIds.filter((artistId) => artistId !== primaryArtistId);
        collaboratorIds.forEach((collaboratorId) => {
            const key = buildPairKey(primaryArtistId, collaboratorId);
            const existing = evidenceByPair.get(key);
            if (existing) {
                existing.trackIds.push(track.canonicalTrackId);
                existing.weight += relationWeight("featured_with");
                existing.confidence = Math.max(existing.confidence, 0.8);
                return;
            }
            evidenceByPair.set(key, {
                leftCanonicalArtistId: primaryArtistId,
                rightCanonicalArtistId: collaboratorId,
                relationType: "featured_with",
                source: "derived",
                sourceTrust: 0.7,
                confidence: 0.8,
                trackIds: [track.canonicalTrackId],
                releaseIds: track.canonicalReleaseId ? [track.canonicalReleaseId] : [],
                weight: relationWeight("featured_with"),
            });
        });
    });
    Object.values(input.artistsById).forEach((artist) => {
        artist.relatedArtistIds.forEach((relatedArtistId) => {
            const key = buildPairKey(artist.canonicalArtistId, relatedArtistId);
            if (evidenceByPair.has(key)) {
                return;
            }
            evidenceByPair.set(key, {
                leftCanonicalArtistId: artist.canonicalArtistId,
                rightCanonicalArtistId: relatedArtistId,
                relationType: "similar_to",
                source: "derived",
                sourceTrust: 0.6,
                confidence: 0.55,
                trackIds: [],
                releaseIds: [],
                weight: relationWeight("similar_to"),
            });
        });
    });
    return [...evidenceByPair.values()].sort((left, right) => {
        if (left.weight !== right.weight) {
            return right.weight - left.weight;
        }
        return buildPairKey(left.leftCanonicalArtistId, left.rightCanonicalArtistId).localeCompare(buildPairKey(right.leftCanonicalArtistId, right.rightCanonicalArtistId));
    });
}
function buildArtistRelationGraph(evidences) {
    const graph = {};
    evidences.forEach((evidence) => {
        const weight = evidence.weight * evidence.confidence * evidence.sourceTrust;
        const edge = {
            leftId: evidence.leftCanonicalArtistId,
            rightId: evidence.rightCanonicalArtistId,
            weight,
            source: evidence.source,
            confidence: evidence.confidence,
            reason: evidence.relationType,
        };
        graph[evidence.leftCanonicalArtistId] = [...(graph[evidence.leftCanonicalArtistId] ?? []), edge];
        graph[evidence.rightCanonicalArtistId] = [
            ...(graph[evidence.rightCanonicalArtistId] ?? []),
            { ...edge, leftId: evidence.rightCanonicalArtistId, rightId: evidence.leftCanonicalArtistId },
        ];
    });
    Object.keys(graph).forEach((artistId) => {
        graph[artistId] = graph[artistId].sort((left, right) => {
            if (left.weight !== right.weight) {
                return right.weight - left.weight;
            }
            return left.rightId.localeCompare(right.rightId);
        });
    });
    return graph;
}
function inferRelationTypeFromArtistText(artistText) {
    return FEATURE_PATTERN.test(artistText) ? "featured_with" : null;
}
