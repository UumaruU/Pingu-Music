import test from "node:test";
import assert from "node:assert/strict";
import { buildCanonicalLyricsLookupContext } from "../src/app/services/canonicalLyricsPolicy";
import { CanonicalTrack, Track } from "../src/app/types";

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

function createCanonicalTrack(overrides: Partial<CanonicalTrack> = {}): CanonicalTrack {
  return {
    canonicalId: overrides.canonicalId ?? "soft:test",
    searchSetId: overrides.searchSetId ?? "search:test",
    canonicalizationVersion: overrides.canonicalizationVersion ?? 1,
    canonicalizationRevision: overrides.canonicalizationRevision ?? 1,
    clusterRevision: overrides.clusterRevision ?? 1,
    title: overrides.title ?? "Song Title",
    artist: overrides.artist ?? "Artist",
    titleFlavor: overrides.titleFlavor ?? ["original"],
    variantTrackIds: overrides.variantTrackIds ?? ["track-1"],
    preferredVariantId: overrides.preferredVariantId ?? "track-1",
    targetDuration: overrides.targetDuration ?? 180,
    quality: overrides.quality ?? {
      clusterConfidence: 0.9,
    },
    ...overrides,
  };
}

test("uses canonical cache key when confidence is sufficient and cluster is safe", () => {
  const preferredTrack = createTrack({
    id: "track-2",
    providerId: "hitmos",
    title: "Song Title",
    artist: "Artist",
    duration: 180,
  });
  const result = buildCanonicalLyricsLookupContext({
    track: createTrack({
      id: "track-1",
      providerId: "soundcloud",
      duration: 181,
      normalizedTitleCore: "song title",
      normalizedArtistCore: "artist",
    }),
    canonicalTrack: createCanonicalTrack({
      preferredVariantId: "track-2",
      variantTrackIds: ["track-1", "track-2"],
    }),
    variantTracks: [
      createTrack({
        id: "track-1",
        providerId: "soundcloud",
        duration: 181,
      }),
      preferredTrack,
    ],
  });

  assert.equal(result.canReuseCanonicalLyrics, true);
  assert.match(result.cacheKey, /^canonical:/);
  assert.equal(result.lookupTitle, "Song Title");
  assert.equal(result.lookupArtist, "Artist");
  assert.equal(result.lookupCandidates[0].source, "canonical");
  assert.equal(result.lookupCandidates[0].trackId, "track-2");
  assert.equal(result.lookupCandidates[1]?.trackId, "track-1");
  assert.deepEqual(result.variantTrackIds, ["track-1", "track-2"]);
});

test("falls back to variant cache when canonical cluster has blockers", () => {
  const result = buildCanonicalLyricsLookupContext({
    track: createTrack({
      id: "track-1",
      duration: 181,
    }),
    canonicalTrack: createCanonicalTrack({
      debugInfo: {
        blockingKeys: [],
        pairScoring: [],
        mergeBlockers: ["flavor_conflict"],
        clusterReasons: [],
        aliasRemapHistory: [],
      },
    }),
  });

  assert.equal(result.canReuseCanonicalLyrics, false);
  assert.equal(result.cacheKey, "variant:track-1");
  assert.equal(result.lookupCandidates[0]?.source, "variant");
});

test("falls back to variant cache when duration mismatch is too large", () => {
  const result = buildCanonicalLyricsLookupContext({
    track: createTrack({
      id: "track-1",
      duration: 200,
    }),
    canonicalTrack: createCanonicalTrack({
      targetDuration: 180,
    }),
  });

  assert.equal(result.canReuseCanonicalLyrics, false);
  assert.equal(result.cacheKey, "variant:track-1");
});

test("deduplicates identical canonical and variant lyric lookups", () => {
  const result = buildCanonicalLyricsLookupContext({
    track: createTrack({
      id: "track-1",
      title: "Song Title",
      artist: "Artist",
    }),
    canonicalTrack: createCanonicalTrack({
      preferredVariantId: "track-1",
      variantTrackIds: ["track-1", "track-2"],
    }),
    variantTracks: [
      createTrack({
        id: "track-1",
        title: "Song Title",
        artist: "Artist",
      }),
      createTrack({
        id: "track-2",
        title: "Song Title",
        artist: "Artist",
      }),
    ],
  });

  assert.equal(result.lookupCandidates.length, 1);
  assert.equal(result.lookupCandidates[0]?.source, "canonical");
});
