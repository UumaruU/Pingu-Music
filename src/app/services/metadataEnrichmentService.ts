import { useAppStore } from "../store/appStore";
import { Artist, Release, Track } from "../types";
import { cacheService } from "./cacheService";
import { coverArtService } from "./coverArtService";
import { musicBrainzService } from "./musicBrainzService";
import { normalizationService } from "./normalizationService";

function chooseBestMatch(track: Track) {
  return (matches: Awaited<ReturnType<typeof musicBrainzService.searchRecording>>) => {
    if (!matches.length) {
      return null;
    }

    const normalizedTrackTitle =
      track.normalizedTitle ?? normalizationService.normalizeTrackTitle(track.title);
    const normalizedArtistName =
      track.normalizedArtistName ?? normalizationService.normalizeArtistName(track.artist);

    return (
      matches.find((match) => {
        const titleMatches =
          normalizationService.normalizeTrackTitle(match.title) === normalizedTrackTitle;
        const artistMatches = match.artistName
          ? normalizationService.normalizeArtistName(match.artistName) === normalizedArtistName
          : false;

        return titleMatches && artistMatches;
      }) ??
      matches.find((match) => match.score >= 95) ??
      matches[0]
    );
  };
}

class MetadataEnrichmentService {
  private queue = Promise.resolve();
  private activeRequests = new Map<string, Promise<Track | null>>();

  private hydrateCachedTrack(trackId: string, cachedTrack: Track) {
    useAppStore.getState().setTrackMetadata(trackId, cachedTrack);
  }

  private async enrichFreshTrack(track: Track) {
    const normalizedTitle = normalizationService.normalizeTrackTitle(track.title);
    const normalizedArtistName = normalizationService.normalizeArtistName(track.artist);

    useAppStore.getState().setTrackMetadata(track.id, {
      normalizedTitle,
      normalizedArtistName,
      metadataStatus: "matching",
    });

    const rawMatches = await musicBrainzService.searchRecording(track.title, track.artist);
    const normalizedMatches =
      normalizedTitle !== track.title || normalizedArtistName !== track.artist
        ? await musicBrainzService.searchRecording(normalizedTitle, normalizedArtistName)
        : [];
    const matches = [...rawMatches, ...normalizedMatches].reduce<
      Awaited<ReturnType<typeof musicBrainzService.searchRecording>>
    >((acc, match) => {
      if (acc.some((existing) => existing.recordingId === match.recordingId)) {
        return acc;
      }
      acc.push(match);
      return acc;
    }, []);
    const bestMatch = chooseBestMatch({
      ...track,
      normalizedTitle,
      normalizedArtistName,
    } as Track)(matches);

    if (!bestMatch || bestMatch.score < 70) {
      const failedTrack = {
        ...useAppStore.getState().tracks[track.id],
        normalizedTitle,
        normalizedArtistName,
        metadataStatus: "failed" as const,
      };

      useAppStore.getState().setTrackMetadata(track.id, failedTrack);
      await cacheService.set("tracks", track.id, failedTrack);
      return failedTrack;
    }

    useAppStore.getState().setTrackMetadata(track.id, {
      metadataStatus: "matched",
      normalizedTitle,
      normalizedArtistName,
    });

    const [artist, release] = await Promise.all([
      bestMatch.artistId ? musicBrainzService.getArtist(bestMatch.artistId) : Promise.resolve(null),
      bestMatch.releaseId ? musicBrainzService.getRelease(bestMatch.releaseId) : Promise.resolve(null),
    ]);

    if (artist) {
      useAppStore.getState().hydrateArtists([artist]);
      await cacheService.set("artists", artist.id, artist);
    }

    const coverUrl = await coverArtService.resolveCoverUrl(bestMatch.releaseId, track.coverUrl);
    const enrichedRelease = release
      ? {
          ...release,
          coverUrl,
        }
      : null;

    if (enrichedRelease) {
      useAppStore.getState().upsertRelease(enrichedRelease);
      await cacheService.set("releases", enrichedRelease.id, enrichedRelease);
    }

    const enrichedTrack: Track = {
      ...useAppStore.getState().tracks[track.id],
      coverUrl,
      normalizedTitle,
      normalizedArtistName,
      musicBrainzRecordingId: bestMatch.recordingId,
      musicBrainzArtistId: artist?.id ?? bestMatch.artistId,
      musicBrainzReleaseId: enrichedRelease?.id ?? bestMatch.releaseId,
      musicBrainzReleaseGroupId:
        enrichedRelease?.musicBrainzReleaseGroupId ?? bestMatch.releaseGroupId,
      albumTitle: enrichedRelease?.title ?? bestMatch.releaseTitle,
      releaseDate: enrichedRelease?.date ?? bestMatch.releaseDate,
      metadataStatus: "enriched",
    };

    useAppStore.getState().setTrackMetadata(track.id, enrichedTrack);
    await cacheService.set("tracks", track.id, enrichedTrack);
    return enrichedTrack;
  }

  async enrichTrack(trackId: string) {
    const track = useAppStore.getState().tracks[trackId];

    if (!track) {
      return null;
    }

    if (track.metadataStatus === "enriched" && track.musicBrainzRecordingId) {
      return track;
    }

    const activeRequest = this.activeRequests.get(trackId);

    if (activeRequest) {
      return activeRequest;
    }

    const task = this.queue
      .catch(() => undefined)
      .then(async () => {
        const cachedTrack = await cacheService.get<Track>("tracks", trackId);

        if (cachedTrack) {
          this.hydrateCachedTrack(trackId, cachedTrack);

          if (cachedTrack.musicBrainzArtistId) {
            const cachedArtist = await cacheService.get<Artist>(
              "artists",
              cachedTrack.musicBrainzArtistId,
            );
            if (cachedArtist) {
              useAppStore.getState().hydrateArtists([cachedArtist]);
            }
          }

          if (cachedTrack.musicBrainzReleaseId) {
            const cachedRelease = await cacheService.get<Release>(
              "releases",
              cachedTrack.musicBrainzReleaseId,
            );
            if (cachedRelease) {
              useAppStore.getState().upsertRelease(cachedRelease);
            }
          }

          return cachedTrack;
        }

        return this.enrichFreshTrack(useAppStore.getState().tracks[trackId] ?? track);
      })
      .finally(() => {
        this.activeRequests.delete(trackId);
      });

    this.queue = task.then(() => undefined);
    this.activeRequests.set(trackId, task);

    return task;
  }

  enrichTracks(trackIds: string[]) {
    trackIds.forEach((trackId) => {
      void this.enrichTrack(trackId);
    });
  }
}

export const metadataEnrichmentService = new MetadataEnrichmentService();
