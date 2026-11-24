import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPlaylistDetailsPatch,
  normalizePlaylistDetailsDraft,
} from "../src/app/services/playlistDetails";
import { Playlist } from "../src/app/types";

const playlist: Playlist = {
  id: "playlist:test",
  name: "Old name",
  trackIds: ["track:1", "track:2"],
  createdAt: "2026-05-14T00:00:00.000Z",
};

test("normalizes editable playlist details", () => {
  assert.deepEqual(
    normalizePlaylistDetailsDraft({
      name: "  Night ride  ",
      coverUrl: "  https://example.com/cover.jpg  ",
      coverAccent: "#ff4dd2",
    }),
    {
      name: "Night ride",
      coverUrl: "https://example.com/cover.jpg",
      coverAccent: "#ff4dd2",
    },
  );
});

test("applies playlist details without losing tracks or creation metadata", () => {
  const updated = applyPlaylistDetailsPatch(playlist, {
    name: "New name",
    coverUrl: "https://example.com/new.jpg",
    coverAccent: "#37d46b",
  });

  assert.equal(updated.name, "New name");
  assert.equal(updated.coverUrl, "https://example.com/new.jpg");
  assert.equal(updated.coverAccent, "#37d46b");
  assert.deepEqual(updated.trackIds, playlist.trackIds);
  assert.equal(updated.createdAt, playlist.createdAt);
  assert.ok(updated.updatedAt);
});

test("keeps existing cover when a partial playlist patch omits cover url", () => {
  const updated = applyPlaylistDetailsPatch(
    {
      ...playlist,
      coverUrl: "https://example.com/current.jpg",
      coverAccent: "#23d3ee",
    },
    {
      name: "Only name changed",
    },
  );

  assert.equal(updated.name, "Only name changed");
  assert.equal(updated.coverUrl, "https://example.com/current.jpg");
  assert.equal(updated.coverAccent, "#23d3ee");
});
