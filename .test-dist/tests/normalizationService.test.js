"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const trackIdentity_1 = require("../src/app/core/tracks/trackIdentity");
const normalizationService_1 = require("../src/app/services/normalizationService");
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
(0, node_test_1.default)("extracts title flavor separately from normalized title core", () => {
    const normalized = normalizationService_1.normalizationService.normalizeTrackForCanonicalization(createTrack({
        title: "My Song (Live Acoustic Remix) feat. Someone Official Audio",
        artist: "Main Artist feat. Guest",
    }));
    strict_1.default.deepEqual(normalized.titleFlavor, ["acoustic", "live", "remix"]);
    strict_1.default.equal(normalized.normalizedTitleCore, "my song");
    strict_1.default.equal(normalized.primaryArtist, "main artist");
    strict_1.default.equal(normalized.normalizedArtistCore, "main artist");
});
(0, node_test_1.default)("uses original flavor when no explicit variant marker exists", () => {
    const normalized = normalizationService_1.normalizationService.normalizeTrackForCanonicalization(createTrack({
        title: "Regular Song",
    }));
    strict_1.default.deepEqual(normalized.titleFlavor, ["original"]);
    strict_1.default.equal(normalized.normalizedTitleCore, "regular song");
});
(0, node_test_1.default)("strips duplicated artist prefix from the title when artist already matches", () => {
    const normalized = (0, trackIdentity_1.withTrackProviderDefaults)(createTrack({
        title: "Noize MC - Вселенная бесконечна",
        artist: "Noize MC",
    }));
    strict_1.default.equal(normalized.title, "Вселенная бесконечна");
    strict_1.default.equal(normalized.artist, "Noize MC");
});
(0, node_test_1.default)("replaces suspicious uploader artist with the embedded artist from the title", () => {
    const normalized = (0, trackIdentity_1.withTrackProviderDefaults)(createTrack({
        providerId: "soundcloud",
        title: "Noize MC - Ругань Из-За Стены",
        artist: "S C A R E D",
    }));
    strict_1.default.equal(normalized.title, "Ругань Из-За Стены");
    strict_1.default.equal(normalized.artist, "Noize MC");
});
(0, node_test_1.default)("keeps regular hyphenated titles untouched when the existing artist looks valid", () => {
    const normalized = (0, trackIdentity_1.withTrackProviderDefaults)(createTrack({
        title: "Love - Hate",
        artist: "The Band",
    }));
    strict_1.default.equal(normalized.title, "Love - Hate");
    strict_1.default.equal(normalized.artist, "The Band");
});
