import test from "node:test";
import assert from "node:assert/strict";
import { trackCanonicalizationService } from "../src/app/services/trackCanonicalizationService";
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

test("merges obvious duplicates and keeps canonical result deterministic", () => {
  const result = trackCanonicalizationService.buildCanonicalizationResult({
    searchSetId: "search:test",
    canonicalizationRevision: 1,
    tracks: [
      createTrack({
        id: "hitmos:1",
        title: "Song Name",
        artist: "Artist Name",
        duration: 181,
      }),
      createTrack({
        id: "soundcloud:1",
        providerId: "soundcloud",
        title: "Song Name Official Audio",
        artist: "Artist Name",
        duration: 180,
      }),
    ],
  });

  assert.equal(result.canonicalTracks.length, 1);
  assert.equal(result.searchCanonicalResultIds.length, 1);
  assert.deepEqual(result.canonicalTracks[0].variantTrackIds, ["hitmos:1", "soundcloud:1"]);
  assert.equal(result.canonicalTracks[0].preferredVariantId, "hitmos:1");
  assert.match(result.canonicalTracks[0].canonicalId, /^soft:/);
});

test("does not merge original with live version", () => {
  const result = trackCanonicalizationService.buildCanonicalizationResult({
    searchSetId: "search:test",
    canonicalizationRevision: 1,
    tracks: [
      createTrack({
        id: "track:original",
        title: "Song Name",
        artist: "Artist Name",
      }),
      createTrack({
        id: "track:live",
        title: "Song Name (Live)",
        artist: "Artist Name",
      }),
    ],
  });

  assert.equal(result.canonicalTracks.length, 2);
});

test("remaps soft canonical id to mbrec when enrichment adds recording ids", () => {
  const initialResult = trackCanonicalizationService.buildCanonicalizationResult({
    searchSetId: "search:upgrade",
    canonicalizationRevision: 1,
    tracks: [
      createTrack({
        id: "track:a",
        title: "Song Name",
        artist: "Artist Name",
      }),
      createTrack({
        id: "track:b",
        title: "Song Name",
        artist: "Artist Name",
        duration: 181,
      }),
    ],
  });

  const upgradedResult = trackCanonicalizationService.buildCanonicalizationResult({
    searchSetId: "search:upgrade",
    canonicalizationRevision: 2,
    previousResult: initialResult,
    tracks: [
      createTrack({
        id: "track:a",
        title: "Song Name",
        artist: "Artist Name",
        musicBrainzRecordingId: "mb-recording-1",
      }),
      createTrack({
        id: "track:b",
        title: "Song Name",
        artist: "Artist Name",
        duration: 181,
        musicBrainzRecordingId: "mb-recording-1",
      }),
    ],
  });

  assert.equal(upgradedResult.canonicalTracks.length, 1);
  assert.equal(upgradedResult.canonicalTracks[0].canonicalId, "mbrec:mb-recording-1");
  assert.equal(upgradedResult.remaps.length, 1);
  assert.equal(upgradedResult.remaps[0].reason, "identifier_upgrade");
  assert.equal(
    upgradedResult.aliasTargetsByCanonicalId[initialResult.canonicalTracks[0].canonicalId]?.canonicalId,
    "mbrec:mb-recording-1",
  );
  assert.deepEqual(upgradedResult.searchCanonicalResultIds, ["mbrec:mb-recording-1"]);
});

test("splits a previously merged cluster when conflicting MB ids appear", () => {
  const initialResult = trackCanonicalizationService.buildCanonicalizationResult({
    searchSetId: "search:split",
    canonicalizationRevision: 1,
    tracks: [
      createTrack({
        id: "track:a",
        title: "Song Name",
        artist: "Artist Name",
      }),
      createTrack({
        id: "track:b",
        title: "Song Name",
        artist: "Artist Name",
      }),
    ],
  });

  const splitResult = trackCanonicalizationService.buildCanonicalizationResult({
    searchSetId: "search:split",
    canonicalizationRevision: 2,
    previousResult: initialResult,
    tracks: [
      createTrack({
        id: "track:a",
        title: "Song Name",
        artist: "Artist Name",
        musicBrainzRecordingId: "mb-recording-a",
      }),
      createTrack({
        id: "track:b",
        title: "Song Name",
        artist: "Artist Name",
        musicBrainzRecordingId: "mb-recording-b",
      }),
    ],
  });

  assert.equal(splitResult.canonicalTracks.length, 2);
  assert.equal(splitResult.canonicalIdByVariantTrackId["track:a"], "mbrec:mb-recording-a");
  assert.equal(splitResult.canonicalIdByVariantTrackId["track:b"], "mbrec:mb-recording-b");
  assert.equal(splitResult.remaps.length, 1);
  assert.equal(splitResult.remaps[0].reason, "identifier_upgrade");
});

test("merges duplicate mb recording clusters into one canonical id", () => {
  const result = trackCanonicalizationService.buildCanonicalizationResult({
    searchSetId: "search:mbrec-dedupe",
    canonicalizationRevision: 1,
    tracks: [
      createTrack({
        id: "track:mb:a",
        title: "Song Name",
        artist: "Artist Name",
        musicBrainzRecordingId: "mb-recording-42",
      }),
      createTrack({
        id: "track:mb:b",
        title: "Song Name Official Audio",
        artist: "Art1st Name",
        musicBrainzRecordingId: "mb-recording-42",
      }),
      createTrack({
        id: "track:mb:c",
        title: "Song Name",
        artist: "Artist Name",
        musicBrainzRecordingId: "mb-recording-42",
        duration: 181,
      }),
    ],
  });

  assert.equal(result.canonicalTracks.length, 1);
  assert.deepEqual(result.searchCanonicalResultIds, ["mbrec:mb-recording-42"]);
  assert.deepEqual(
    result.canonicalTracks[0].variantTrackIds.sort(),
    ["track:mb:a", "track:mb:b", "track:mb:c"].sort(),
  );
});

test("groups typo variants of the same song and keeps cover/minus separate", () => {
  const result = trackCanonicalizationService.buildCanonicalizationResult({
    searchSetId: "search:noize",
    canonicalizationRevision: 1,
    tracks: [
      createTrack({
        id: "track:noize",
        title: "Вселенная бесконечна",
        artist: "Noize MC",
        duration: 264,
        coverUrl: "https://example.com/noize-cover.jpg",
      }),
      createTrack({
        id: "track:noise",
        title: "Вселенная бесконечна",
        artist: "Noise MC",
        duration: 264,
        coverUrl: "https://placehold.co/300x300?text=Pingu+Music",
      }),
      createTrack({
        id: "track:noiz",
        title: "вселенная бесконечна",
        artist: "Noiz MC",
        duration: 266,
        coverUrl: "https://placehold.co/300x300?text=Pingu+Music",
      }),
      createTrack({
        id: "track:cyr",
        title: "Вселенная бесконечная",
        artist: "Нойз МС",
        duration: 264,
        coverUrl: "https://placehold.co/300x300?text=Pingu+Music",
      }),
      createTrack({
        id: "track:minus",
        title: "Вселенная бесконечна (минус)",
        artist: "Нойз МС",
        duration: 262,
      }),
      createTrack({
        id: "track:cover",
        title: "Вселенная бесконечна (cover by Someone)",
        artist: "Noizw MC",
        duration: 235,
      }),
    ],
  });

  const mainCluster = result.canonicalTracks.find((track) =>
    track.variantTrackIds.includes("track:noize"),
  );

  assert.ok(mainCluster);
  if (!mainCluster) {
    throw new Error("Expected main cluster to be present");
  }
  assert.deepEqual(
    mainCluster.variantTrackIds.sort(),
    ["track:cyr", "track:noise", "track:noiz", "track:noize"].sort(),
  );
  assert.equal(mainCluster.artist, "Noize MC");
  assert.equal(mainCluster.coverUrl, "https://example.com/noize-cover.jpg");
  assert.equal(mainCluster.preferredVariantId, "track:noize");
  assert.equal(result.canonicalIdByVariantTrackId["track:minus"] !== mainCluster.canonicalId, true);
  assert.equal(result.canonicalIdByVariantTrackId["track:cover"] !== mainCluster.canonicalId, true);
  assert.equal(result.canonicalTracks.length, 3);
});
