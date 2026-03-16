import test from "node:test";
import assert from "node:assert/strict";
import { withTrackProviderDefaults } from "../src/app/core/tracks/trackIdentity";
import { normalizationService } from "../src/app/services/normalizationService";
import { Track } from "../src/app/types";

function createTrack(overrides: Partial<Track> = {}): Track {
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

test("extracts title flavor separately from normalized title core", () => {
  const normalized = normalizationService.normalizeTrackForCanonicalization(
    createTrack({
      title: "My Song (Live Acoustic Remix) feat. Someone Official Audio",
      artist: "Main Artist feat. Guest",
    }),
  );

  assert.deepEqual(normalized.titleFlavor, ["acoustic", "live", "remix"]);
  assert.equal(normalized.normalizedTitleCore, "my song");
  assert.equal(normalized.primaryArtist, "main artist");
  assert.equal(normalized.normalizedArtistCore, "main artist");
});

test("uses original flavor when no explicit variant marker exists", () => {
  const normalized = normalizationService.normalizeTrackForCanonicalization(
    createTrack({
      title: "Regular Song",
    }),
  );

  assert.deepEqual(normalized.titleFlavor, ["original"]);
  assert.equal(normalized.normalizedTitleCore, "regular song");
});

test("strips duplicated artist prefix from the title when artist already matches", () => {
  const normalized = withTrackProviderDefaults(
    createTrack({
      title: "Noize MC - Вселенная бесконечна",
      artist: "Noize MC",
    }),
  );

  assert.equal(normalized.title, "Вселенная бесконечна");
  assert.equal(normalized.artist, "Noize MC");
});

test("replaces suspicious uploader artist with the embedded artist from the title", () => {
  const normalized = withTrackProviderDefaults(
    createTrack({
      providerId: "soundcloud",
      title: "Noize MC - Ругань Из-За Стены",
      artist: "S C A R E D",
    }),
  );

  assert.equal(normalized.title, "Ругань Из-За Стены");
  assert.equal(normalized.artist, "Noize MC");
});

test("keeps regular hyphenated titles untouched when the existing artist looks valid", () => {
  const normalized = withTrackProviderDefaults(
    createTrack({
      title: "Love - Hate",
      artist: "The Band",
    }),
  );

  assert.equal(normalized.title, "Love - Hate");
  assert.equal(normalized.artist, "The Band");
});
