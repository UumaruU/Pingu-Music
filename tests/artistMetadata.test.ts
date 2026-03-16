import test from "node:test";
import assert from "node:assert/strict";
import { mergeArtistMetadata, mergeArtistTags } from "../src/app/utils/artistMetadata";

test("merges artist tags from multiple sources without duplicates", () => {
  const merged = mergeArtistTags(
    ["hip hop", "rap", "Инди"],
    ["Rap", "Рок", "hip hop"],
  );

  assert.deepEqual(merged, ["hip hop", "rap", "Инди", "Рок"]);
});

test("preserves existing artist metadata while appending new external tags", () => {
  const merged = mergeArtistMetadata(
    {
      id: "artist-1",
      name: "Noize MC",
      musicBrainzArtistId: "artist-1",
      tags: ["alternative hip hop", "rap rock"],
      imageUrl: "https://example.com/current.jpg",
    },
    {
      id: "artist-1",
      name: "Noize MC",
      musicBrainzArtistId: "artist-1",
      tags: ["Рэп и хип-хоп", "rap rock"],
    },
  );

  assert.deepEqual(merged.tags, ["Рэп и хип-хоп", "rap rock", "alternative hip hop"]);
  assert.equal(merged.imageUrl, "https://example.com/current.jpg");
});
