"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const recommendation_1 = require("../src/recommendation");
const defaultRecommendationConfig_1 = require("../src/recommendation/config/defaultRecommendationConfig");
function createMemoryCacheStore() {
    const bag = new Map();
    return {
        async getJson(key) {
            return bag.get(key) ?? null;
        },
        async setJson(key, value) {
            bag.set(key, value);
        },
        async remove(key) {
            bag.delete(key);
        },
    };
}
function createSnapshot() {
    return {
        snapshotRevision: "snapshot:test",
        generatedAt: "2026-03-16T00:00:00.000Z",
        canonicalizationVersion: 1,
        canonicalizationRevision: 1,
        tracksById: {
            "track:current": {
                canonicalTrackId: "track:current",
                title: "Current Song",
                normalizedTitleCore: "current song",
                titleFlavor: ["original"],
                canonicalArtistIds: ["artist:a1"],
                primaryCanonicalArtistId: "artist:a1",
                featuringCanonicalArtistIds: [],
                canonicalReleaseId: "release:r1",
                year: 2024,
                labelIds: [],
                language: null,
                explicit: false,
                targetDurationMs: 180000,
                tagIds: ["tag:rock"],
                tagWeights: { "tag:rock": 1 },
                preferredVariantId: "variant:current",
                playableVariantIds: ["variant:current"],
                sourceEvidence: [],
                quality: {
                    clusterConfidence: 0.9,
                    trustScore: 0.85,
                    metadataCompleteness: 0.9,
                    popularityPrior: 0.1,
                },
            },
            "track:same-artist": {
                canonicalTrackId: "track:same-artist",
                title: "Same Artist Song",
                normalizedTitleCore: "same artist song",
                titleFlavor: ["original"],
                canonicalArtistIds: ["artist:a1"],
                primaryCanonicalArtistId: "artist:a1",
                featuringCanonicalArtistIds: [],
                canonicalReleaseId: "release:r2",
                year: 2024,
                labelIds: [],
                language: null,
                explicit: false,
                targetDurationMs: 182000,
                tagIds: ["tag:rock", "tag:indie-rock"],
                tagWeights: { "tag:rock": 1, "tag:indie-rock": 0.9 },
                preferredVariantId: "variant:same",
                playableVariantIds: ["variant:same"],
                sourceEvidence: [],
                quality: {
                    clusterConfidence: 0.92,
                    trustScore: 0.88,
                    metadataCompleteness: 0.92,
                    popularityPrior: 0.1,
                },
            },
            "track:related": {
                canonicalTrackId: "track:related",
                title: "Related Artist Song",
                normalizedTitleCore: "related artist song",
                titleFlavor: ["original"],
                canonicalArtistIds: ["artist:a2"],
                primaryCanonicalArtistId: "artist:a2",
                featuringCanonicalArtistIds: [],
                canonicalReleaseId: "release:r3",
                year: 2023,
                labelIds: [],
                language: null,
                explicit: false,
                targetDurationMs: 181000,
                tagIds: ["tag:rock"],
                tagWeights: { "tag:rock": 1 },
                preferredVariantId: "variant:related",
                playableVariantIds: ["variant:related"],
                sourceEvidence: [],
                quality: {
                    clusterConfidence: 0.9,
                    trustScore: 0.82,
                    metadataCompleteness: 0.85,
                    popularityPrior: 0.05,
                },
            },
            "track:broken": {
                canonicalTrackId: "track:broken",
                title: "Broken Track",
                normalizedTitleCore: "broken track",
                titleFlavor: ["original"],
                canonicalArtistIds: ["artist:a1"],
                primaryCanonicalArtistId: "artist:a1",
                featuringCanonicalArtistIds: [],
                canonicalReleaseId: "release:r2",
                year: 2024,
                labelIds: [],
                language: null,
                explicit: false,
                targetDurationMs: 181000,
                tagIds: ["tag:rock"],
                tagWeights: { "tag:rock": 1 },
                preferredVariantId: null,
                playableVariantIds: [],
                sourceEvidence: [],
                quality: {
                    clusterConfidence: 0.95,
                    trustScore: 0.9,
                    metadataCompleteness: 0.8,
                    popularityPrior: 0.2,
                },
            },
        },
        artistsById: {
            "artist:a1": {
                canonicalArtistId: "artist:a1",
                musicBrainzArtistId: "mb-a1",
                name: "Artist A",
                normalizedName: "artist a",
                aliases: [],
                country: "US",
                type: "Person",
                tagIds: ["tag:rock", "tag:indie-rock"],
                tagWeights: { "tag:rock": 1, "tag:indie-rock": 0.9 },
                relatedArtistIds: ["artist:a2"],
                frequentCollaboratorIds: [],
                releaseIds: ["release:r1", "release:r2"],
                trackIds: ["track:current", "track:same-artist", "track:broken"],
                sourceEvidence: [],
                quality: { confidence: 0.9, trustScore: 0.9, metadataCompleteness: 0.9 },
            },
            "artist:a2": {
                canonicalArtistId: "artist:a2",
                musicBrainzArtistId: "mb-a2",
                name: "Artist B",
                normalizedName: "artist b",
                aliases: [],
                country: "US",
                type: "Person",
                tagIds: ["tag:rock"],
                tagWeights: { "tag:rock": 1 },
                relatedArtistIds: ["artist:a1"],
                frequentCollaboratorIds: [],
                releaseIds: ["release:r3"],
                trackIds: ["track:related"],
                sourceEvidence: [],
                quality: { confidence: 0.8, trustScore: 0.8, metadataCompleteness: 0.7 },
            },
        },
        releasesById: {
            "release:r1": {
                canonicalReleaseId: "release:r1",
                musicBrainzReleaseId: "mb-r1",
                musicBrainzReleaseGroupId: "mb-rg1",
                title: "Release 1",
                canonicalArtistIds: ["artist:a1"],
                releaseType: "album",
                year: 2024,
                labelIds: [],
                coverUrl: null,
                trackIds: ["track:current"],
                tagIds: ["tag:rock"],
                sourceEvidence: [],
                quality: { confidence: 0.8, trustScore: 0.8, metadataCompleteness: 0.8 },
            },
            "release:r2": {
                canonicalReleaseId: "release:r2",
                musicBrainzReleaseId: "mb-r2",
                musicBrainzReleaseGroupId: "mb-rg2",
                title: "Release 2",
                canonicalArtistIds: ["artist:a1"],
                releaseType: "album",
                year: 2024,
                labelIds: [],
                coverUrl: null,
                trackIds: ["track:same-artist", "track:broken"],
                tagIds: ["tag:rock"],
                sourceEvidence: [],
                quality: { confidence: 0.8, trustScore: 0.8, metadataCompleteness: 0.8 },
            },
            "release:r3": {
                canonicalReleaseId: "release:r3",
                musicBrainzReleaseId: "mb-r3",
                musicBrainzReleaseGroupId: "mb-rg3",
                title: "Release 3",
                canonicalArtistIds: ["artist:a2"],
                releaseType: "album",
                year: 2023,
                labelIds: [],
                coverUrl: null,
                trackIds: ["track:related"],
                tagIds: ["tag:rock"],
                sourceEvidence: [],
                quality: { confidence: 0.75, trustScore: 0.75, metadataCompleteness: 0.75 },
            },
        },
        tagsById: {
            "tag:rock": {
                canonicalTagId: "tag:rock",
                slug: "rock",
                displayName: "Rock",
                aliases: ["rock"],
                tagType: "genre",
                parentTagId: null,
                normalizedForm: "rock",
                sourceEvidence: [],
                quality: { confidence: 0.8, trustScore: 0.8 },
            },
            "tag:indie-rock": {
                canonicalTagId: "tag:indie-rock",
                slug: "indie-rock",
                displayName: "Indie-Rock",
                aliases: ["indie rock"],
                tagType: "subgenre",
                parentTagId: "tag:rock",
                normalizedForm: "indie-rock",
                sourceEvidence: [],
                quality: { confidence: 0.75, trustScore: 0.75 },
            },
        },
        canonicalIdByVariantTrackId: {
            "variant:current": "track:current",
            "variant:same": "track:same-artist",
            "variant:related": "track:related",
        },
        artistToTracks: {
            "artist:a1": ["track:current", "track:same-artist", "track:broken"],
            "artist:a2": ["track:related"],
        },
        releaseToTracks: {
            "release:r1": ["track:current"],
            "release:r2": ["track:same-artist", "track:broken"],
            "release:r3": ["track:related"],
        },
        trackToArtists: {
            "track:current": ["artist:a1"],
            "track:same-artist": ["artist:a1"],
            "track:related": ["artist:a2"],
            "track:broken": ["artist:a1"],
        },
        artistToReleases: {
            "artist:a1": ["release:r1", "release:r2"],
            "artist:a2": ["release:r3"],
        },
        artistRelations: {
            "artist:a1": [
                {
                    leftId: "artist:a1",
                    rightId: "artist:a2",
                    weight: 0.15,
                    source: "derived",
                    confidence: 0.75,
                    reason: "collaborated_with",
                },
            ],
            "artist:a2": [
                {
                    leftId: "artist:a2",
                    rightId: "artist:a1",
                    weight: 0.15,
                    source: "derived",
                    confidence: 0.75,
                    reason: "collaborated_with",
                },
            ],
        },
        relatedArtists: {
            "artist:a1": [
                {
                    leftId: "artist:a1",
                    rightId: "artist:a2",
                    weight: 0.15,
                    source: "derived",
                    confidence: 0.7,
                    reason: "shared-tag-similarity",
                },
            ],
            "artist:a2": [
                {
                    leftId: "artist:a2",
                    rightId: "artist:a1",
                    weight: 0.15,
                    source: "derived",
                    confidence: 0.7,
                    reason: "shared-tag-similarity",
                },
            ],
        },
        tagToTracks: {
            "tag:rock": ["track:current", "track:same-artist", "track:related", "track:broken"],
            "tag:indie-rock": ["track:same-artist"],
        },
        tagToArtists: {
            "tag:rock": ["artist:a1", "artist:a2"],
            "tag:indie-rock": ["artist:a1"],
        },
        releaseAdjacency: {
            "release:r1": ["release:r2", "release:r3"],
            "release:r2": ["release:r1", "release:r3"],
            "release:r3": ["release:r1", "release:r2"],
        },
        playableVariantsByCanonicalTrackId: {
            "track:current": ["variant:current"],
            "track:same-artist": ["variant:same"],
            "track:related": ["variant:related"],
            "track:broken": [],
        },
    };
}
function createContext() {
    return {
        mode: "autoplay",
        currentCanonicalTrackId: "track:current",
        currentPrimaryArtistId: "artist:a1",
        currentFeaturedArtistIds: [],
        currentTrackTagIds: ["tag:rock"],
        currentArtistTagIds: ["tag:rock", "tag:indie-rock"],
        currentReleaseId: "release:r1",
        currentFlavor: "original",
        currentDurationMs: 180000,
        recentTrackIds: ["track:current"],
        recentArtistIds: ["artist:a1"],
        recentTagCloud: { "tag:rock": 1 },
        recentRecommendationIds: [],
        skippedTrackIds: [],
        favoritedTrackIds: [],
    };
}
function createEngine(snapshot) {
    const cacheStore = createMemoryCacheStore();
    const dependencies = {
        catalogReader: {
            async getSnapshot() {
                return snapshot;
            },
        },
        userHistoryReader: {
            async getRecentHistory() {
                return [];
            },
        },
        favoritesReader: {
            async getFavoriteTrackIds() {
                return [];
            },
        },
        playlistsReader: {
            async getPlaylists() {
                return [];
            },
        },
        playableVariantReader: {
            async getPlayableVariantIds(canonicalTrackId) {
                return snapshot.playableVariantsByCanonicalTrackId[canonicalTrackId] ?? [];
            },
            async resolvePreferredVariantId(canonicalTrackId) {
                return snapshot.tracksById[canonicalTrackId]?.preferredVariantId ?? null;
            },
        },
        providerMetadataReader: {
            async getProviderMetadata() {
                return {};
            },
        },
        cacheStore,
        resultWriter: {
            async writeTrackResult() { },
            async writeTrackRanking() { },
            async writeArtistRanking() { },
        },
        clock: {
            now() {
                return Date.parse("2026-03-16T00:00:00.000Z");
            },
        },
    };
    return (0, recommendation_1.createRecommendationEngine)(dependencies, defaultRecommendationConfig_1.defaultRecommendationConfig);
}
(0, node_test_1.default)("returns deterministic next-track recommendations with preferredVariantId", async () => {
    const snapshot = createSnapshot();
    const engine = createEngine(snapshot);
    const engineClone = createEngine(snapshot);
    const engineForRanking = createEngine(snapshot);
    const context = createContext();
    const first = await engine.getNextRecommendedTrack(context);
    const second = await engineClone.getNextRecommendedTrack(context);
    const ranking = await engineForRanking.getRecommendedTracks({ mode: "autoplay", canonicalTrackId: "track:current" }, context);
    strict_1.default.ok(first);
    strict_1.default.equal(first?.canonicalTrackId, "track:related");
    strict_1.default.equal(first?.preferredVariantId, "variant:related");
    strict_1.default.deepEqual(first, second);
    strict_1.default.deepEqual(ranking.map((item) => item.canonicalTrackId), ["track:related", "track:same-artist"]);
});
(0, node_test_1.default)("deduplicates tracks found through multiple channels and filters broken candidates", async () => {
    const snapshot = createSnapshot();
    const engine = createEngine(snapshot);
    const ranking = await engine.getRecommendedTracks({ mode: "autoplay", canonicalTrackId: "track:current" }, createContext());
    strict_1.default.equal(ranking.filter((item) => item.canonicalTrackId === "track:same-artist").length, 1);
    strict_1.default.equal(ranking.some((item) => item.canonicalTrackId === "track:broken"), false);
});
(0, node_test_1.default)("favorite reinforcement and early skip penalties affect ranking", async () => {
    const snapshot = createSnapshot();
    const engine = createEngine(snapshot);
    const context = createContext();
    const before = await engine.getRecommendedTracks({ mode: "autoplay", canonicalTrackId: "track:current" }, context);
    strict_1.default.equal(before[0]?.canonicalTrackId, "track:related");
    await engine.updateAffinityFromFavorite({
        canonicalTrackId: "track:same-artist",
        occurredAt: "2026-03-16T00:10:00.000Z",
        isFavorite: true,
    });
    const afterFavorite = await engine.getRecommendedTracks({ mode: "autoplay", canonicalTrackId: "track:current" }, context);
    strict_1.default.equal(afterFavorite[0]?.canonicalTrackId, "track:same-artist");
    await engine.updateAffinityFromPlayback({
        canonicalTrackId: "track:same-artist",
        listenedMs: 5000,
        trackDurationMs: 180000,
        occurredAt: "2026-03-16T00:15:00.000Z",
        endedNaturally: false,
        wasSkipped: true,
        sessionId: "session:test",
        seedChannels: ["sameArtist"],
    });
    const afterSkip = await engine.getRecommendedTracks({ mode: "autoplay", canonicalTrackId: "track:current" }, context);
    strict_1.default.equal(afterSkip[0]?.canonicalTrackId, "track:related");
});
