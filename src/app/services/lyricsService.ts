import { LrclibProvider } from "../providers/lrclibProvider";
import { Lyrics } from "../types";
import { useAppStore } from "../store/appStore";
import { cacheService } from "./cacheService";
import { buildCanonicalLyricsLookupContext, LyricsLookupCandidate } from "./canonicalLyricsPolicy";
import { searchCanonicalizationOrchestrator } from "./searchCanonicalizationOrchestrator";

class LyricsService {
  private provider = new LrclibProvider();
  private activeRequests = new Map<string, Promise<Lyrics>>();

  private buildVariantCacheKey(trackId: string) {
    return `variant:${trackId}`;
  }

  private async getCachedLyricsEntries(cacheKeys: string[]) {
    const entries = await Promise.all(
      [...new Set(cacheKeys)].map(async (cacheKey) => {
        const lyrics = await cacheService.get<Lyrics>("lyrics", cacheKey);
        return [cacheKey, lyrics] as const;
      }),
    );

    return new Map(entries.filter((entry): entry is readonly [string, Lyrics] => !!entry[1]));
  }

  private buildPrimaryCacheKeys(trackId: string, cacheKey: string) {
    return [...new Set([cacheKey, this.buildVariantCacheKey(trackId), trackId])];
  }

  private async persistLyrics(cacheKeys: string[], lyrics: Lyrics) {
    await Promise.all(
      [...new Set(cacheKeys)].map((cacheKey) => cacheService.set("lyrics", cacheKey, lyrics)),
    );
  }

  private findReadyClusterLyrics(trackId: string, clusterTrackIds: string[]) {
    const state = useAppStore.getState();
    const existingReadyLyrics = clusterTrackIds
      .map((variantTrackId) => state.lyricsByTrackId[variantTrackId])
      .find((lyrics): lyrics is Lyrics => !!lyrics && lyrics.status === "ready");

    if (!existingReadyLyrics) {
      return null;
    }

    return {
      ...existingReadyLyrics,
      trackId,
    } satisfies Lyrics;
  }

  private getPendingCandidates(
    lookupCandidates: LyricsLookupCandidate[],
    cachedLyricsEntries: Map<string, Lyrics>,
  ) {
    return lookupCandidates.filter((candidate) =>
      candidate.cacheKeys.every((cacheKey) => cachedLyricsEntries.get(cacheKey)?.status !== "missing"),
    );
  }

  async getLyrics(trackId: string) {
    const activeRequest = this.activeRequests.get(trackId);

    if (activeRequest) {
      return activeRequest;
    }

    const request = (async () => {
      const state = useAppStore.getState();
      const track = state.tracks[trackId];

      if (!track) {
        const missing: Lyrics = {
          trackId,
          source: "LRCLIB",
          status: "missing",
        };
        useAppStore.getState().setLyrics(missing);
        return missing;
      }

      const canonicalId = state.canonicalIdByVariantTrackId[trackId];
      const canonicalTrack = canonicalId ? state.canonicalTracksById[canonicalId] : null;
      const variantTracks = canonicalTrack
        ? canonicalTrack.variantTrackIds
            .map((variantTrackId) => state.tracks[variantTrackId])
            .filter((variantTrack): variantTrack is typeof track => !!variantTrack)
        : [track];
      const lookupContext = buildCanonicalLyricsLookupContext({
        track,
        canonicalTrack,
        variantTracks,
      });
      const existingLyrics = state.lyricsByTrackId[trackId];
      const clusterTrackIds = [...new Set([trackId, ...lookupContext.variantTrackIds])];
      const clusterReadyLyrics = this.findReadyClusterLyrics(trackId, clusterTrackIds);

      if (clusterReadyLyrics) {
        useAppStore.getState().setLyrics(clusterReadyLyrics);
        await this.persistLyrics(
          this.buildPrimaryCacheKeys(trackId, lookupContext.cacheKey),
          clusterReadyLyrics,
        );
        searchCanonicalizationOrchestrator.refreshTrack(trackId);
        return clusterReadyLyrics;
      }

      const shouldShortCircuitExistingMissing =
        existingLyrics?.status === "missing" && lookupContext.lookupCandidates.length <= 1;

      if (existingLyrics && (existingLyrics.status === "ready" || shouldShortCircuitExistingMissing)) {
        return existingLyrics;
      }

      const cachedLyricsEntries = await this.getCachedLyricsEntries(lookupContext.cacheKeys);
      const cachedReadyLyrics = [...cachedLyricsEntries.values()].find((lyrics) => lyrics.status === "ready");

      if (cachedReadyLyrics) {
        const hydratedLyrics = {
          ...cachedReadyLyrics,
          trackId,
        } satisfies Lyrics;
        useAppStore.getState().setLyrics(hydratedLyrics);
        await this.persistLyrics(this.buildPrimaryCacheKeys(trackId, lookupContext.cacheKey), hydratedLyrics);
        searchCanonicalizationOrchestrator.refreshTrack(trackId);
        return hydratedLyrics;
      }

      const pendingCandidates = this.getPendingCandidates(
        lookupContext.lookupCandidates,
        cachedLyricsEntries,
      );

      if (!pendingCandidates.length && cachedLyricsEntries.size) {
        const missing: Lyrics = {
          trackId,
          source: "LRCLIB",
          status: "missing",
        };
        useAppStore.getState().setLyrics(missing);
        await this.persistLyrics(this.buildPrimaryCacheKeys(trackId, lookupContext.cacheKey), missing);
        searchCanonicalizationOrchestrator.refreshTrack(trackId);
        return missing;
      }

      useAppStore.getState().setLyrics({
        trackId,
        source: "LRCLIB",
        status: "loading",
      });

      try {
        let lyrics: Lyrics | null = null;
        let matchedCandidate: LyricsLookupCandidate | null = null;

        for (const candidate of pendingCandidates) {
          matchedCandidate = candidate;
          lyrics = await this.provider.getLyrics({
            trackId,
            title: candidate.lookupTitle,
            artist: candidate.lookupArtist,
            duration: candidate.lookupDuration,
          });

          if (lyrics) {
            break;
          }
        }

        const nextLyrics: Lyrics =
          lyrics ?? {
            trackId,
            source: "LRCLIB",
            status: "missing",
          };

        useAppStore.getState().setLyrics(nextLyrics);

        if (lyrics) {
          const successCacheKeys = lookupContext.canReuseCanonicalLyrics
            ? [
                ...lookupContext.cacheKeys,
                ...this.buildPrimaryCacheKeys(trackId, lookupContext.cacheKey),
              ]
            : [
                ...(matchedCandidate?.cacheKeys ?? []),
                ...this.buildPrimaryCacheKeys(trackId, lookupContext.cacheKey),
              ];
          await this.persistLyrics(successCacheKeys, nextLyrics);
        } else {
          await this.persistLyrics(
            [
              ...this.buildPrimaryCacheKeys(trackId, lookupContext.cacheKey),
              ...pendingCandidates.flatMap((candidate) => candidate.cacheKeys),
            ],
            nextLyrics,
          );
        }

        searchCanonicalizationOrchestrator.refreshTrack(trackId);
        return nextLyrics;
      } catch (error) {
        const failedLyrics: Lyrics = {
          trackId,
          source: "LRCLIB",
          status: "failed",
          error: error instanceof Error ? error.message : "Failed to load lyrics",
        };
        useAppStore.getState().setLyrics(failedLyrics);
        await this.persistLyrics(this.buildPrimaryCacheKeys(trackId, lookupContext.cacheKey), failedLyrics);
        searchCanonicalizationOrchestrator.refreshTrack(trackId);
        return failedLyrics;
      } finally {
        this.activeRequests.delete(trackId);
      }
    })();

    this.activeRequests.set(trackId, request);
    return request;
  }
}

export const lyricsService = new LyricsService();
