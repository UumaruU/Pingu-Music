// Frontend adapter: legacy app entrypoint for pure canonicalization logic extracted to src/recommendation.

import {
  buildCanonicalLyricsCacheKey as buildRecommendationCanonicalLyricsCacheKey,
  recommendationTrackCanonicalizationService,
  resolvePlayableTrackId as resolveRecommendationPlayableTrackId,
} from "../../recommendation/canonical-graph/trackCanonicalization";
import {
  CANONICALIZATION_VERSION,
  canonicalizationConfig,
} from "../config/canonicalizationConfig";
import {
  CanonicalTrack,
  CanonicalizationConfig,
  CanonicalizationResult,
  Lyrics,
  Track,
} from "../types";

function toDomainLyricsMap(lyricsByTrackId: Record<string, Lyrics> | undefined) {
  if (!lyricsByTrackId) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(lyricsByTrackId).map(([trackId, lyrics]) => [
      trackId,
      {
        plain: lyrics.plain,
        synced: lyrics.synced,
        status: lyrics.status,
      },
    ]),
  );
}

export function resolvePlayableTrackId(canonicalTrack: CanonicalTrack) {
  return resolveRecommendationPlayableTrackId(canonicalTrack as unknown as Parameters<typeof resolveRecommendationPlayableTrackId>[0]);
}

export function buildCanonicalLyricsCacheKey(
  canonicalTrack: Pick<CanonicalTrack, "title" | "artist" | "targetDuration">,
  config: CanonicalizationConfig,
) {
  return buildRecommendationCanonicalLyricsCacheKey(
    canonicalTrack as unknown as Parameters<typeof buildRecommendationCanonicalLyricsCacheKey>[0],
    config as unknown as Parameters<typeof buildRecommendationCanonicalLyricsCacheKey>[1],
  );
}

export const trackCanonicalizationService = {
  canonicalizationVersion: CANONICALIZATION_VERSION,

  buildCanonicalizationResult(input: {
    searchSetId: string;
    tracks: Track[];
    lyricsByTrackId?: Record<string, Lyrics>;
    previousResult?: CanonicalizationResult | null;
    canonicalizationRevision: number;
    config?: CanonicalizationConfig;
    includeDebugInfo?: boolean;
  }) {
    return recommendationTrackCanonicalizationService.buildCanonicalizationResult({
      ...input,
      lyricsByTrackId: toDomainLyricsMap(input.lyricsByTrackId),
      tracks: input.tracks,
      previousResult: input.previousResult as unknown as Parameters<
        typeof recommendationTrackCanonicalizationService.buildCanonicalizationResult
      >[0]["previousResult"],
      config: (input.config ?? canonicalizationConfig) as unknown as Parameters<
        typeof recommendationTrackCanonicalizationService.buildCanonicalizationResult
      >[0]["config"],
    }) as unknown as CanonicalizationResult;
  },
};
