"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const canonicalLyricsPolicy_1 = require("../src/app/services/canonicalLyricsPolicy");
function createTrack(overrides = {}) {
    return {
        id: overrides.id ?? "track-1",
        providerId: overrides.providerId ?? "hitmos",
        providerTrackId: overrides.providerTrackId ?? overrides.id ?? "track-1",
        title: overrides.title ?? "Song Title",
        artist: overrides.artist ?? "Artist",
        coverUrl: overrides.coverUrl ?? "https://example.com/cover.jpg",
        audioUrl: overrides.audioUrl ?? "https://example.com/audio.mp3",
        duration: overrides.duration ?? 180,
        sourceUrl: overrides.sourceUrl ?? "https://example.com/source",
        isFavorite: overrides.isFavorite ?? false,
        downloadState: overrides.downloadState ?? "idle",
        metadataStatus: overrides.metadataStatus ?? "raw",
        ...overrides,
    };
}
function createCanonicalTrack(overrides = {}) {
    return {
        canonicalId: overrides.canonicalId ?? "soft:test",
        searchSetId: overrides.searchSetId ?? "search:test",
        canonicalizationVersion: overrides.canonicalizationVersion ?? 1,
        canonicalizationRevision: overrides.canonicalizationRevision ?? 1,
        clusterRevision: overrides.clusterRevision ?? 1,
        title: overrides.title ?? "Song Title",
        artist: overrides.artist ?? "Artist",
        titleFlavor: overrides.titleFlavor ?? ["original"],
        variantTrackIds: overrides.variantTrackIds ?? ["track-1"],
        preferredVariantId: overrides.preferredVariantId ?? "track-1",
        targetDuration: overrides.targetDuration ?? 180,
        quality: overrides.quality ?? {
            clusterConfidence: 0.9,
        },
        ...overrides,
    };
}
(0, node_test_1.default)("uses canonical cache key when confidence is sufficient and cluster is safe", () => {
    const preferredTrack = createTrack({
        id: "track-2",
        providerId: "hitmos",
        title: "Song Title",
        artist: "Artist",
        duration: 180,
    });
    const result = (0, canonicalLyricsPolicy_1.buildCanonicalLyricsLookupContext)({
        track: createTrack({
            id: "track-1",
            providerId: "soundcloud",
            duration: 181,
            normalizedTitleCore: "song title",
            normalizedArtistCore: "artist",
        }),
        canonicalTrack: createCanonicalTrack({
            preferredVariantId: "track-2",
            variantTrackIds: ["track-1", "track-2"],
        }),
        variantTracks: [
            createTrack({
                id: "track-1",
                providerId: "soundcloud",
                duration: 181,
            }),
            preferredTrack,
        ],
    });
    strict_1.default.equal(result.canReuseCanonicalLyrics, true);
    strict_1.default.match(result.cacheKey, /^canonical:/);
    strict_1.default.equal(result.lookupTitle, "Song Title");
    strict_1.default.equal(result.lookupArtist, "Artist");
    strict_1.default.equal(result.lookupCandidates[0].source, "canonical");
    strict_1.default.equal(result.lookupCandidates[0].trackId, "track-2");
    strict_1.default.equal(result.lookupCandidates[1]?.trackId, "track-1");
    strict_1.default.deepEqual(result.variantTrackIds, ["track-1", "track-2"]);
});
(0, node_test_1.default)("falls back to variant cache when canonical cluster has blockers", () => {
    const result = (0, canonicalLyricsPolicy_1.buildCanonicalLyricsLookupContext)({
        track: createTrack({
            id: "track-1",
            duration: 181,
        }),
        canonicalTrack: createCanonicalTrack({
            debugInfo: {
                blockingKeys: [],
                pairScoring: [],
                mergeBlockers: ["flavor_conflict"],
                clusterReasons: [],
                aliasRemapHistory: [],
            },
        }),
    });
    strict_1.default.equal(result.canReuseCanonicalLyrics, false);
    strict_1.default.equal(result.cacheKey, "variant:track-1");
    strict_1.default.equal(result.lookupCandidates[0]?.source, "variant");
});
(0, node_test_1.default)("falls back to variant cache when duration mismatch is too large", () => {
    const result = (0, canonicalLyricsPolicy_1.buildCanonicalLyricsLookupContext)({
        track: createTrack({
            id: "track-1",
            duration: 200,
        }),
        canonicalTrack: createCanonicalTrack({
            targetDuration: 180,
        }),
    });
    strict_1.default.equal(result.canReuseCanonicalLyrics, false);
    strict_1.default.equal(result.cacheKey, "variant:track-1");
});
(0, node_test_1.default)("deduplicates identical canonical and variant lyric lookups", () => {
    const result = (0, canonicalLyricsPolicy_1.buildCanonicalLyricsLookupContext)({
        track: createTrack({
            id: "track-1",
            title: "Song Title",
            artist: "Artist",
        }),
        canonicalTrack: createCanonicalTrack({
            preferredVariantId: "track-1",
            variantTrackIds: ["track-1", "track-2"],
        }),
        variantTracks: [
            createTrack({
                id: "track-1",
                title: "Song Title",
                artist: "Artist",
            }),
            createTrack({
                id: "track-2",
                title: "Song Title",
                artist: "Artist",
            }),
        ],
    });
    strict_1.default.equal(result.lookupCandidates.length, 1);
    strict_1.default.equal(result.lookupCandidates[0]?.source, "canonical");
});
