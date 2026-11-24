import test from "node:test";
import assert from "node:assert/strict";
import {
  FAVORITE_TRACK_PREVIEW_LIMIT,
  buildCollectionSections,
  getFavoriteTrackPreview,
} from "../src/app/pages/favoritesCollection";
import { Playlist, Track } from "../src/app/types";

function createTrack(id: string): Track {
  return {
    id,
    providerId: "hitmos",
    title: `Track ${id}`,
    artist: `Artist ${id}`,
    coverUrl: "",
    audioUrl: "",
    duration: 180,
    sourceUrl: "",
    isFavorite: true,
    downloadState: "idle",
    metadataStatus: "raw",
  };
}

function createPlaylist(id: string): Playlist {
  return {
    id,
    name: `Playlist ${id}`,
    trackIds: [],
    createdAt: "2026-05-14T00:00:00.000Z",
  };
}

test("favorite track preview is capped for the collection overview", () => {
  const tracks = Array.from({ length: FAVORITE_TRACK_PREVIEW_LIMIT + 3 }, (_, index) =>
    createTrack(String(index + 1)),
  );

  assert.deepEqual(
    getFavoriteTrackPreview(tracks).map((track) => track.id),
    tracks.slice(0, FAVORITE_TRACK_PREVIEW_LIMIT).map((track) => track.id),
  );
});

test("collection sections keep playlists at the bottom of favorites", () => {
  const sections = buildCollectionSections({
    favoriteTracks: [createTrack("liked")],
    favoriteArtistCount: 2,
    playlists: [createPlaylist("playlist")],
  });

  assert.deepEqual(
    sections.map((section) => section.id),
    ["liked-tracks", "favorite-artists", "playlists"],
  );
  assert.equal(sections[sections.length - 1]?.title, "Плейлисты");
});
