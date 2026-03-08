import { LrclibProvider } from "../providers/lrclibProvider";
import { Lyrics } from "../types";
import { useAppStore } from "../store/appStore";
import { cacheService } from "./cacheService";

class LyricsService {
  private provider = new LrclibProvider();
  private activeRequests = new Map<string, Promise<Lyrics>>();

  async getLyrics(trackId: string) {
    const existingLyrics = useAppStore.getState().lyricsByTrackId[trackId];

    if (existingLyrics && (existingLyrics.status === "ready" || existingLyrics.status === "missing")) {
      return existingLyrics;
    }

    const activeRequest = this.activeRequests.get(trackId);

    if (activeRequest) {
      return activeRequest;
    }

    const request = (async () => {
      const cachedLyrics = await cacheService.get<Lyrics>("lyrics", trackId);

      if (cachedLyrics) {
        useAppStore.getState().setLyrics(cachedLyrics);
        return cachedLyrics;
      }

      const track = useAppStore.getState().tracks[trackId];

      if (!track) {
        const missing: Lyrics = {
          trackId,
          source: "LRCLIB",
          status: "missing",
        };
        useAppStore.getState().setLyrics(missing);
        return missing;
      }

      useAppStore.getState().setLyrics({
        trackId,
        source: "LRCLIB",
        status: "loading",
      });

      try {
        const lyrics = await this.provider.getLyrics({
          trackId,
          title: track.normalizedTitle || track.title,
          artist: track.normalizedArtistName || track.artist,
          duration: track.duration,
        });

        const nextLyrics: Lyrics =
          lyrics ?? {
            trackId,
            source: "LRCLIB",
            status: "missing",
          };

        useAppStore.getState().setLyrics(nextLyrics);
        await cacheService.set("lyrics", trackId, nextLyrics);
        return nextLyrics;
      } catch (error) {
        const failedLyrics: Lyrics = {
          trackId,
          source: "LRCLIB",
          status: "failed",
          error: error instanceof Error ? error.message : "Не удалось загрузить текст",
        };
        useAppStore.getState().setLyrics(failedLyrics);
        await cacheService.set("lyrics", trackId, failedLyrics);
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
