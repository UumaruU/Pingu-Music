"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const trackCanonicalizationService_1 = require("../src/app/services/trackCanonicalizationService");
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
(0, node_test_1.default)("merges obvious duplicates and keeps canonical result deterministic", () => {
    const result = trackCanonicalizationService_1.trackCanonicalizationService.buildCanonicalizationResult({
        searchSetId: "search:test",
        canonicalizationRevision: 1,
        tracks: [
            createTrack({
                id: "hitmos:1",
                title: "Song Name",
                artist: "Artist Name",
                duration: 181,
            }),
            createTrack({
                id: "soundcloud:1",
                providerId: "soundcloud",
                title: "Song Name Official Audio",
                artist: "Artist Name",
                duration: 180,
            }),
        ],
    });
    strict_1.default.equal(result.canonicalTracks.length, 1);
    strict_1.default.equal(result.searchCanonicalResultIds.length, 1);
    strict_1.default.deepEqual(result.canonicalTracks[0].variantTrackIds, ["hitmos:1", "soundcloud:1"]);
    strict_1.default.equal(result.canonicalTracks[0].preferredVariantId, "hitmos:1");
    strict_1.default.match(result.canonicalTracks[0].canonicalId, /^soft:/);
});
(0, node_test_1.default)("does not merge original with live version", () => {
    const result = trackCanonicalizationService_1.trackCanonicalizationService.buildCanonicalizationResult({
        searchSetId: "search:test",
        canonicalizationRevision: 1,
        tracks: [
            createTrack({
                id: "track:original",
                title: "Song Name",
                artist: "Artist Name",
            }),
            createTrack({
                id: "track:live",
                title: "Song Name (Live)",
                artist: "Artist Name",
            }),
        ],
    });
    strict_1.default.equal(result.canonicalTracks.length, 2);
});
(0, node_test_1.default)("remaps soft canonical id to mbrec when enrichment adds recording ids", () => {
    const initialResult = trackCanonicalizationService_1.trackCanonicalizationService.buildCanonicalizationResult({
        searchSetId: "search:upgrade",
        canonicalizationRevision: 1,
        tracks: [
            createTrack({
                id: "track:a",
                title: "Song Name",
                artist: "Artist Name",
            }),
            createTrack({
                id: "track:b",
                title: "Song Name",
                artist: "Artist Name",
                duration: 181,
            }),
        ],
    });
    const upgradedResult = trackCanonicalizationService_1.trackCanonicalizationService.buildCanonicalizationResult({
        searchSetId: "search:upgrade",
        canonicalizationRevision: 2,
        previousResult: initialResult,
        tracks: [
            createTrack({
                id: "track:a",
                title: "Song Name",
                artist: "Artist Name",
                musicBrainzRecordingId: "mb-recording-1",
            }),
            createTrack({
                id: "track:b",
                title: "Song Name",
                artist: "Artist Name",
                duration: 181,
                musicBrainzRecordingId: "mb-recording-1",
            }),
        ],
    });
    strict_1.default.equal(upgradedResult.canonicalTracks.length, 1);
    strict_1.default.equal(upgradedResult.canonicalTracks[0].canonicalId, "mbrec:mb-recording-1");
    strict_1.default.equal(upgradedResult.remaps.length, 1);
    strict_1.default.equal(upgradedResult.remaps[0].reason, "identifier_upgrade");
    strict_1.default.equal(upgradedResult.aliasTargetsByCanonicalId[initialResult.canonicalTracks[0].canonicalId]?.canonicalId, "mbrec:mb-recording-1");
    strict_1.default.deepEqual(upgradedResult.searchCanonicalResultIds, ["mbrec:mb-recording-1"]);
});
(0, node_test_1.default)("splits a previously merged cluster when conflicting MB ids appear", () => {
    const initialResult = trackCanonicalizationService_1.trackCanonicalizationService.buildCanonicalizationResult({
        searchSetId: "search:split",
        canonicalizationRevision: 1,
        tracks: [
            createTrack({
                id: "track:a",
                title: "Song Name",
                artist: "Artist Name",
            }),
            createTrack({
                id: "track:b",
                title: "Song Name",
                artist: "Artist Name",
            }),
        ],
    });
    const splitResult = trackCanonicalizationService_1.trackCanonicalizationService.buildCanonicalizationResult({
        searchSetId: "search:split",
        canonicalizationRevision: 2,
        previousResult: initialResult,
        tracks: [
            createTrack({
                id: "track:a",
                title: "Song Name",
                artist: "Artist Name",
                musicBrainzRecordingId: "mb-recording-a",
            }),
            createTrack({
                id: "track:b",
                title: "Song Name",
                artist: "Artist Name",
                musicBrainzRecordingId: "mb-recording-b",
            }),
        ],
    });
    strict_1.default.equal(splitResult.canonicalTracks.length, 2);
    strict_1.default.equal(splitResult.canonicalIdByVariantTrackId["track:a"], "mbrec:mb-recording-a");
    strict_1.default.equal(splitResult.canonicalIdByVariantTrackId["track:b"], "mbrec:mb-recording-b");
    strict_1.default.equal(splitResult.remaps.length, 1);
    strict_1.default.equal(splitResult.remaps[0].reason, "identifier_upgrade");
});
(0, node_test_1.default)("merges duplicate mb recording clusters into one canonical id", () => {
    const result = trackCanonicalizationService_1.trackCanonicalizationService.buildCanonicalizationResult({
        searchSetId: "search:mbrec-dedupe",
        canonicalizationRevision: 1,
        tracks: [
            createTrack({
                id: "track:mb:a",
                title: "Song Name",
                artist: "Artist Name",
                musicBrainzRecordingId: "mb-recording-42",
            }),
            createTrack({
                id: "track:mb:b",
                title: "Song Name Official Audio",
                artist: "Art1st Name",
                musicBrainzRecordingId: "mb-recording-42",
            }),
            createTrack({
                id: "track:mb:c",
                title: "Song Name",
                artist: "Artist Name",
                musicBrainzRecordingId: "mb-recording-42",
                duration: 181,
            }),
        ],
    });
    strict_1.default.equal(result.canonicalTracks.length, 1);
    strict_1.default.deepEqual(result.searchCanonicalResultIds, ["mbrec:mb-recording-42"]);
    strict_1.default.deepEqual(result.canonicalTracks[0].variantTrackIds.sort(), ["track:mb:a", "track:mb:b", "track:mb:c"].sort());
});
(0, node_test_1.default)("groups typo variants of the same song and keeps cover/minus separate", () => {
    const result = trackCanonicalizationService_1.trackCanonicalizationService.buildCanonicalizationResult({
        searchSetId: "search:noize",
        canonicalizationRevision: 1,
        tracks: [
            createTrack({
                id: "track:noize",
                title: "Вселенная бесконечна",
                artist: "Noize MC",
                duration: 264,
                coverUrl: "https://example.com/noize-cover.jpg",
            }),
            createTrack({
                id: "track:noise",
                title: "Вселенная бесконечна",
                artist: "Noise MC",
                duration: 264,
                coverUrl: "https://placehold.co/300x300?text=Pingu+Music",
            }),
            createTrack({
                id: "track:noiz",
                title: "вселенная бесконечна",
                artist: "Noiz MC",
                duration: 266,
                coverUrl: "https://placehold.co/300x300?text=Pingu+Music",
            }),
            createTrack({
                id: "track:cyr",
                title: "Вселенная бесконечная",
                artist: "Нойз МС",
                duration: 264,
                coverUrl: "https://placehold.co/300x300?text=Pingu+Music",
            }),
            createTrack({
                id: "track:minus",
                title: "Вселенная бесконечна (минус)",
                artist: "Нойз МС",
                duration: 262,
            }),
            createTrack({
                id: "track:cover",
                title: "Вселенная бесконечна (cover by Someone)",
                artist: "Noizw MC",
                duration: 235,
            }),
        ],
    });
    const mainCluster = result.canonicalTracks.find((track) => track.variantTrackIds.includes("track:noize"));
    strict_1.default.ok(mainCluster);
    if (!mainCluster) {
        throw new Error("Expected main cluster to be present");
    }
    strict_1.default.deepEqual(mainCluster.variantTrackIds.sort(), ["track:cyr", "track:noise", "track:noiz", "track:noize"].sort());
    strict_1.default.equal(mainCluster.artist, "Noize MC");
    strict_1.default.equal(mainCluster.coverUrl, "https://example.com/noize-cover.jpg");
    strict_1.default.equal(mainCluster.preferredVariantId, "track:noize");
    strict_1.default.equal(result.canonicalIdByVariantTrackId["track:minus"] !== mainCluster.canonicalId, true);
    strict_1.default.equal(result.canonicalIdByVariantTrackId["track:cover"] !== mainCluster.canonicalId, true);
    strict_1.default.equal(result.canonicalTracks.length, 3);
});
