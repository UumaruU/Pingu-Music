"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const streamWavePlayback_1 = require("../src/app/pages/streamWavePlayback");
(0, node_test_1.default)("buildWaveQueueIds returns empty queue when next track is missing", () => {
    strict_1.default.deepEqual((0, streamWavePlayback_1.buildWaveQueueIds)("track:current", null), []);
});
(0, node_test_1.default)("buildWaveQueueIds appends next track after the current one", () => {
    strict_1.default.deepEqual((0, streamWavePlayback_1.buildWaveQueueIds)("track:current", "track:next"), [
        "track:current",
        "track:next",
    ]);
});
(0, node_test_1.default)("resolveStreamWavePlaybackAction syncs queue when playback is already running", () => {
    strict_1.default.deepEqual((0, streamWavePlayback_1.resolveStreamWavePlaybackAction)({
        currentTrackId: "track:current",
        nextTrackId: "track:next",
        isPlaying: true,
    }), {
        type: "sync-queue",
        queueIds: ["track:current", "track:next"],
    });
});
(0, node_test_1.default)("resolveStreamWavePlaybackAction starts current track when wave is connected from pause", () => {
    strict_1.default.deepEqual((0, streamWavePlayback_1.resolveStreamWavePlaybackAction)({
        currentTrackId: "track:current",
        nextTrackId: "track:next",
        isPlaying: false,
    }), {
        type: "play-current",
        queueIds: ["track:current", "track:next"],
        startTrackId: "track:current",
    });
});
(0, node_test_1.default)("resolveStreamWavePlaybackAction starts the next track when nothing is playing yet", () => {
    strict_1.default.deepEqual((0, streamWavePlayback_1.resolveStreamWavePlaybackAction)({
        currentTrackId: null,
        nextTrackId: "track:next",
        isPlaying: false,
    }), {
        type: "play-next",
        queueIds: ["track:next"],
        startTrackId: "track:next",
    });
});
