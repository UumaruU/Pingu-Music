import test from "node:test";
import assert from "node:assert/strict";
import { mapLmusicTracks } from "../src/app/providers/lmusic/lmusicMapper";

test("maps lmusic tracks into normalized provider-scoped track ids", () => {
  const [track] = mapLmusicTracks([
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

  assert.equal(track.id, "lmusic:21479");
  assert.equal(track.providerId, "lmusic");
  assert.equal(track.providerTrackId, "21479");
  assert.equal(track.coverUrl, "https://lmusic.kz/images/cover/noize-mc-26-04.jpeg");
  assert.equal(track.sourcePriority, 4);
  assert.equal(track.sourceTrustScore, 0.92);
});
