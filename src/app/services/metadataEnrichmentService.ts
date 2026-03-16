import { useAppStore } from "../store/appStore";
import { withTrackProviderDefaults } from "../core/tracks/trackIdentity";
import { Artist, Release, Track } from "../types";
import { cacheService } from "./cacheService";
import { coverArtService } from "./coverArtService";
import { musicBrainzService } from "./musicBrainzService";
import { normalizationService } from "./normalizationService";
import { searchCanonicalizationOrchestrator } from "./searchCanonicalizationOrchestrator";

function chooseBestMatch(track: Track, matches: Awaited<ReturnType<typeof musicBrainzService.searchRecording>>) {
  if (!matches.length) {
    return null;
  }

  const normalized = normalizationService.normalizeTrackForCanonicalization(track);
  const targetDurationMs = Math.round(track.duration * 1000);

  return [...matches]
    .map((match) => {
      const normalizedMatchTitle = normalizationService.normalizeTrackTitleCore(match.title);
      const normalizedMatchArtist = match.artistName
        ? normalizationService.normalizeArtistCore(match.artistName)
        : "";
      const titleSimilarity = normalizedMatchTitle === normalized.normalizedTitleCore
        ? 1
        : normalizedMatchTitle.includes(normalized.normalizedTitleCore) ||
            normalized.normalizedTitleCore.includes(normalizedMatchTitle)
          ? 0.9
          : 0;
      const artistSimilarity = normalizedMatchArtist === normalized.normalizedArtistCore
        ? 1
        : normalizedMatchArtist === normalized.primaryArtist || normalized.primaryArtist === normalizedMatchArtist
          ? 0.95
          : normalizedMatchArtist && normalized.normalizedArtistCore
            ? 0.4
            : 0;
      const durationDelta = match.length ? Math.abs(match.length - targetDurationMs) : 0;
      const durationScore = !match.length ? 0.15 : durationDelta <= 4000 ? 0.6 : durationDelta <= 7000 ? 0.25 : -0.4;
      const score = match.score / 100 + titleSimilarity * 2.2 + artistSimilarity * 1.8 + durationScore;

      return {
        match,
        score,
      };
    })
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      if ((left.match.score ?? 0) !== (right.match.score ?? 0)) {
        return (right.match.score ?? 0) - (left.match.score ?? 0);
      }

      return left.match.recordingId.localeCompare(right.match.recordingId);
    })[0]?.match ?? null;
}

class MetadataEnrichmentService {
  private queue = Promise.resolve();
  private activeRequests = new Map<string, Promise<Track | null>>();

  private hydrateCachedTrack(trackId: string, cachedTrack: Track) {
    useAppStore.getState().setTrackMetadata(trackId, withTrackProviderDefaults(cachedTrack));
    searchCanonicalizationOrchestrator.refreshTrack(trackId);
  }

  private async enrichFreshTrack(track: Track) {
    const normalized = normalizationService.normalizeTrackForCanonicalization(track);
    const normalizedTitle = normalizationService.normalizeTrackTitle(track.title);
    const normalizedArtistName = normalizationService.normalizeArtistName(track.artist);

    useAppStore.getState().setTrackMetadata(track.id, {
      normalizedTitle,
      normalizedArtistName,
      normalizedTitleCore: normalized.normalizedTitleCore,
      normalizedArtistCore: normalized.normalizedArtistCore,
      primaryArtist: normalized.primaryArtist,
      titleFlavor: normalized.titleFlavor,
      metadataStatus: "matching",
    });

    const strictMatches = await musicBrainzService.searchRecording(track.title, track.artist);
    const normalizedMatches =
      normalizedTitle !== track.title || normalizedArtistName !== track.artist
        ? await musicBrainzService.searchRecording(normalizedTitle, normalizedArtistName)
        : [];
    const artistRepairCandidates = await musicBrainzService.searchArtist(
      normalizationService.extractPrimaryArtistName(track.artist),
    );
    const repairedArtist = artistRepairCandidates
      .filter((candidate) => candidate.score >= 80)
      .sort((left, right) => right.score - left.score)[0]?.name;
    const repairedArtistMatches =
      repairedArtist && normalizationService.normalizeArtistName(repairedArtist) !== normalizedArtistName
        ? await musicBrainzService.searchRecording(track.title, repairedArtist)
        : [];
    const titleOnlyMatches = await musicBrainzService.searchRecordingByTitle(track.title);
    const matches = [...strictMatches, ...normalizedMatches, ...repairedArtistMatches, ...titleOnlyMatches].reduce<
      Awaited<ReturnType<typeof musicBrainzService.searchRecording>>
    >((accumulator, match) => {
      if (accumulator.some((existing) => existing.recordingId === match.recordingId)) {
        return accumulator;
      }

      accumulator.push(match);
      return accumulator;
    }, []);
    const bestMatch = chooseBestMatch(
      {
        ...track,
        normalizedTitle,
        normalizedArtistName,
        normalizedTitleCore: normalized.normalizedTitleCore,
        normalizedArtistCore: normalized.normalizedArtistCore,
        primaryArtist: normalized.primaryArtist,
        titleFlavor: normalized.titleFlavor,
      } as Track,
      matches,
    );

    if (!bestMatch || bestMatch.score < 60) {
      const failedTrack = {
        ...withTrackProviderDefaults(useAppStore.getState().tracks[track.id] ?? track),
        normalizedTitle,
        normalizedArtistName,
        normalizedTitleCore: normalized.normalizedTitleCore,
        normalizedArtistCore: normalized.normalizedArtistCore,
        primaryArtist: normalized.primaryArtist,
        titleFlavor: normalized.titleFlavor,
        metadataStatus: "failed" as const,
      };

      useAppStore.getState().setTrackMetadata(track.id, failedTrack);
      await cacheService.set("tracks", track.id, failedTrack);
      searchCanonicalizationOrchestrator.refreshTrack(track.id);
      return failedTrack;
    }

    useAppStore.getState().setTrackMetadata(track.id, {
      metadataStatus: "matched",
      normalizedTitle,
      normalizedArtistName,
      normalizedTitleCore: normalized.normalizedTitleCore,
      normalizedArtistCore: normalized.normalizedArtistCore,
      primaryArtist: normalized.primaryArtist,
      titleFlavor: normalized.titleFlavor,
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
      ...withTrackProviderDefaults(useAppStore.getState().tracks[track.id] ?? track),
      coverUrl,
      normalizedTitle,
      normalizedArtistName,
      normalizedTitleCore: normalized.normalizedTitleCore,
      normalizedArtistCore: normalized.normalizedArtistCore,
      primaryArtist: normalized.primaryArtist,
      titleFlavor: normalized.titleFlavor,
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
    searchCanonicalizationOrchestrator.refreshTrack(track.id);
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
