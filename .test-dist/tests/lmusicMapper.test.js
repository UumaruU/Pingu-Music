"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const lmusicMapper_1 = require("../src/app/providers/lmusic/lmusicMapper");
(0, node_test_1.default)("maps lmusic tracks into normalized provider-scoped track ids", () => {
    const [track] = (0, lmusicMapper_1.mapLmusicTracks)([
        {
            id: "21479",
            title: "26.04",
            artist: "Noize MC",
            coverUrl: "https://lmusic.kz/images/cover/75/noize-mc-26-04.jpeg",
            audioUrl: "https://lmusic.kz/api/stream/21479",
            duration: 230,
            sourceUrl: "https://lmusic.kz/mp3/noize-mc-26-04/21479",
        },
    ]);
    strict_1.default.equal(track.id, "lmusic:21479");
    strict_1.default.equal(track.providerId, "lmusic");
    strict_1.default.equal(track.providerTrackId, "21479");
    strict_1.default.equal(track.coverUrl, "https://lmusic.kz/images/cover/noize-mc-26-04.jpeg");
    strict_1.default.equal(track.sourcePriority, 4);
    strict_1.default.equal(track.sourceTrustScore, 0.92);
});
