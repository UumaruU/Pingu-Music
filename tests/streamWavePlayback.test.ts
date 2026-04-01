import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWaveQueueIds,
  resolveStreamWavePlaybackAction,
} from "../src/app/pages/streamWavePlayback";

test("buildWaveQueueIds returns empty queue when next track is missing", () => {
  assert.deepEqual(buildWaveQueueIds("track:current", null), []);
});

test("buildWaveQueueIds appends next track after the current one", () => {
  assert.deepEqual(buildWaveQueueIds("track:current", "track:next"), [
    "track:current",
    "track:next",
  ]);
});

test("resolveStreamWavePlaybackAction syncs queue when playback is already running", () => {
  assert.deepEqual(
    resolveStreamWavePlaybackAction({
      currentTrackId: "track:current",
      nextTrackId: "track:next",
      isPlaying: true,
    }),
    {
      type: "sync-queue",
      queueIds: ["track:current", "track:next"],
    },
  );
});

test("resolveStreamWavePlaybackAction starts current track when wave is connected from pause", () => {
  assert.deepEqual(
    resolveStreamWavePlaybackAction({
      currentTrackId: "track:current",
      nextTrackId: "track:next",
      isPlaying: false,
    }),
    {
      type: "play-current",
      queueIds: ["track:current", "track:next"],
      startTrackId: "track:current",
    },
  );
});

test("resolveStreamWavePlaybackAction starts the next track when nothing is playing yet", () => {
  assert.deepEqual(
    resolveStreamWavePlaybackAction({
      currentTrackId: null,
      nextTrackId: "track:next",
      isPlaying: false,
    }),
    {
      type: "play-next",
      queueIds: ["track:next"],
      startTrackId: "track:next",
    },
  );
});
