import { useAppStore } from "../store/appStore";
import { Artist, Release, Track } from "../types";
import { cacheService } from "./cacheService";
import { coverArtService } from "./coverArtService";
import { metadataEnrichmentService } from "./metadataEnrichmentService";
import { musicBrainzService } from "./musicBrainzService";
import { musicService } from "./musicService";
import { extractPrimaryArtistName, normalizationService } from "./normalizationService";

interface ReleaseDetailsPayload {
  release: Release;
  trackIds: string[];
  trackTitles: string[];
}

interface DiscographyCachePayload {
  schemaVersion: number;
  albums: Release[];
  singles: Release[];
}

interface ReleaseDetailsCachePayload extends ReleaseDetailsPayload {
  schemaVersion: number;
}

const MIN_ACCEPTABLE_SCORE = 55;
const DISCOGRAPHY_CACHE_SCHEMA_VERSION = 2;
const RELEASE_DETAILS_CACHE_SCHEMA_VERSION = 6;
const MIN_CACHED_MATCH_COVERAGE = 0.9;
const MIN_TITLE_SIMILARITY_FALLBACK = 0.42;
const RELEASE_BONUS_TITLE_SIMILARITY_THRESHOLD = 0.55;

function getTracksForArtist(artistId: string) {
  const tracks = Object.values(useAppStore.getState().tracks);
  return tracks.filter((track) => track.musicBrainzArtistId === artistId);
}

function mergeArtistTrackIds(artistId: string | undefined, trackIds: string[]) {
  if (!artistId || !trackIds.length) {
    return;
  }

  const state = useAppStore.getState();
  const existingTrackIds = state.artistTrackIdsByArtistId[artistId] ?? [];
  const mergedTrackIds = Array.from(new Set([...existingTrackIds, ...trackIds]));

  state.setArtistTracks(artistId, mergedTrackIds);
}

function tokenize(value: string) {
  return normalizationService
    .normalizeArtistName(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function getTokenSimilarity(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let intersectionCount = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      intersectionCount += 1;
    }
  });

  return intersectionCount / Math.max(leftTokens.size, rightTokens.size);
}

function pickBestArtistMatch(
  rawArtist: string,
  matches: Awaited<ReturnType<typeof musicBrainzService.searchArtist>>,
) {
  if (!matches.length) {
    return null;
  }

  const normalizedTarget = normalizationService.normalizeArtistName(rawArtist);

  const exact = matches.find(
    (match) => normalizationService.normalizeArtistName(match.name) === normalizedTarget,
  );

  if (exact) {
    return exact;
  }

  let winner: (typeof matches)[number] | null = null;
  let winnerWeight = -1;

  for (const match of matches) {
    const normalizedCandidate = normalizationService.normalizeArtistName(match.name);
    const containsMatch =
      normalizedCandidate.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedCandidate);
    const similarity = getTokenSimilarity(normalizedTarget, normalizedCandidate);

    if (!containsMatch && similarity < 0.6) {
      continue;
    }

    if (!containsMatch && match.score < 70) {
      continue;
    }

    const weight = (containsMatch ? 120 : 0) + similarity * 100 + match.score * 0.2;

    if (weight > winnerWeight) {
      winner = match;
      winnerWeight = weight;
    }
  }

  return winner;
}

function normalizeComparableArtistName(value: string) {
  return normalizationService.normalizeArtistName(extractPrimaryArtistName(value));
}

function getArtistDiscographyCacheKey(artistId: string) {
  return `artist:${artistId}:discography`;
}

function getReleaseDetailsCacheKey(releaseId: string) {
  return `release:${releaseId}:details`;
}

function dedupeTrackTitles(trackTitles: string[]) {
  const uniqueTitles: string[] = [];
  const seen = new Set<string>();
  const dedupeKey = (value: string) =>
    value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  for (const rawTitle of trackTitles) {
    const title = rawTitle.trim();

    if (!title) {
      continue;
    }

    const normalizedTitle = dedupeKey(title);

    if (seen.has(normalizedTitle)) {
      continue;
    }

    seen.add(normalizedTitle);
    uniqueTitles.push(title);
  }

  return uniqueTitles;
}

class ArtistService {
  private activeCoverHydrations = new Map<string, Promise<void>>();
  private activeArtistResolutions = new Map<string, Promise<string | null>>();
  private activeArtistPageRequests = new Map<
    string,
    Promise<{ artist: Artist; albums: Release[]; singles: Release[]; tracks: Track[] }>
  >();
  private activeReleasePageRequests = new Map<
    string,
    Promise<{ release: Release; tracks: Track[] }>
  >();

  private hydrateReleaseCovers(
    artistId: string,
    releases: Release[],
    fallbackArtistName: string | undefined,
  ) {
    const activeHydration = this.activeCoverHydrations.get(artistId);

    if (activeHydration) {
      return activeHydration;
    }

    const uniqueReleases = releases
      .filter((release) => !!release.musicBrainzReleaseId)
      .filter((release, index, list) => list.findIndex((item) => item.id === release.id) === index);

    const task = (async () => {
      if (!uniqueReleases.length) {
        return;
      }

      const workersCount = Math.min(4, uniqueReleases.length);
      let cursor = 0;

      const worker = async () => {
        while (cursor < uniqueReleases.length) {
          const release = uniqueReleases[cursor];
          cursor += 1;

          if (!release?.musicBrainzReleaseId) {
            continue;
          }

          try {
            const coverUrl = await coverArtService.resolveCoverUrl(
              release.musicBrainzReleaseId,
              release.coverUrl ?? "",
            );

            if (!coverUrl || coverUrl === release.coverUrl) {
              continue;
            }

            const persistedRelease = useAppStore.getState().releases[release.id];
            useAppStore.getState().upsertRelease({
              ...persistedRelease,
              ...release,
              artistId,
              artistName: release.artistName ?? persistedRelease?.artistName ?? fallbackArtistName,
              coverUrl,
            });
          } catch {
            // Ignore cover fetch errors. UI keeps fallback icon.
          }
        }
      };

      await Promise.all(Array.from({ length: workersCount }, worker));
    })().finally(() => {
      this.activeCoverHydrations.delete(artistId);
    });

    this.activeCoverHydrations.set(artistId, task);
    return task;
  }

  private buildTrackQueryVariants(title: string, releaseArtistName: string | undefined) {
    const normalizedTitle = normalizationService.normalizeTrackTitle(title);
    const punctuationStrippedTitle = title
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    const yoNormalizedTitle = punctuationStrippedTitle.replace(/ё/gi, "е");
    const normalizedNoNoiseTitle = normalizedTitle
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    const titleHead = punctuationStrippedTitle.split(" ").slice(0, 4).join(" ").trim();
    const variants = [
      [releaseArtistName ?? "", title].join(" ").trim(),
      [releaseArtistName ?? "", punctuationStrippedTitle].join(" ").trim(),
      title.trim(),
      punctuationStrippedTitle,
      yoNormalizedTitle,
      normalizedNoNoiseTitle,
      releaseArtistName && titleHead ? `${releaseArtistName} ${titleHead}`.trim() : "",
      titleHead,
    ]
      .map((value) => value.trim())
      .filter((value) => value.length >= 2);

    return Array.from(new Set(variants));
  }

  private getTitleSimilarityScore(track: Track, targetTitle: string) {
    const normalizedTrackTitle = normalizationService.normalizeTrackTitle(
      track.normalizedTitle ?? track.title,
    );

    if (normalizedTrackTitle === targetTitle) {
      return 1;
    }

    if (
      normalizedTrackTitle.includes(targetTitle) ||
      targetTitle.includes(normalizedTrackTitle)
    ) {
      return 0.78;
    }

    return getTokenSimilarity(targetTitle, normalizedTrackTitle);
  }

  private getLowQualityPenalty(track: Track) {
    const raw = `${track.title} ${track.artist}`.toLowerCase();
    let penalty = 0;

    if (/(отрывок|тизер|демо|preview|snippet|teaser|instagram|инстаграм|reels)/i.test(raw)) {
      penalty += 80;
    }

    if (track.duration > 0 && track.duration < 70) {
      penalty += 25;
    }

    return penalty;
  }

  private getReleaseTrackScore(
    track: Track,
    targetTitle: string,
    targetArtist: string | null,
    release: Release,
  ) {
    const normalizedTrackTitle = normalizationService.normalizeTrackTitle(
      track.normalizedTitle ?? track.title,
    );
    const titleSimilarity = this.getTitleSimilarityScore(track, targetTitle);

    let score = titleSimilarity * 85;

    if (normalizedTrackTitle === targetTitle) {
      score += 140;
    } else if (
      normalizedTrackTitle.includes(targetTitle) ||
      targetTitle.includes(normalizedTrackTitle)
    ) {
      score += 70;
    }

    if (targetArtist) {
      const normalizedTrackArtist = normalizationService.normalizeArtistName(
        extractPrimaryArtistName(track.normalizedArtistName ?? track.artist),
      );
      const artistSimilarity = getTokenSimilarity(targetArtist, normalizedTrackArtist);

      if (normalizedTrackArtist === targetArtist) {
        score += 35;
      } else if (
        normalizedTrackArtist.includes(targetArtist) ||
        targetArtist.includes(normalizedTrackArtist)
      ) {
        score += 18;
      } else {
        score += artistSimilarity * 20;
      }
    }

    if (titleSimilarity >= RELEASE_BONUS_TITLE_SIMILARITY_THRESHOLD) {
      if (release.musicBrainzReleaseId && track.musicBrainzReleaseId === release.musicBrainzReleaseId) {
        score += 130;
      }

      if (
        release.musicBrainzReleaseGroupId &&
        track.musicBrainzReleaseGroupId === release.musicBrainzReleaseGroupId
      ) {
        score += 95;
      }
    }

    if (track.metadataStatus === "enriched") {
      score += 8;
    }

    return score - this.getLowQualityPenalty(track);
  }

  private pickBestTrackCandidate(
    tracks: Track[],
    targetTitle: string,
    targetArtist: string | null,
    release: Release,
  ) {
    let winner: { track: Track; score: number } | null = null;

    for (const track of tracks) {
      const score = this.getReleaseTrackScore(track, targetTitle, targetArtist, release);

      if (!winner || score > winner.score) {
        winner = { track, score };
      }
    }

    return winner;
  }

  private getRankedTrackCandidates(
    tracks: Track[],
    targetTitle: string,
    targetArtist: string | null,
    release: Release,
  ) {
    return tracks
      .map((track) => ({
        track,
        score: this.getReleaseTrackScore(track, targetTitle, targetArtist, release),
        titleSimilarity: this.getTitleSimilarityScore(track, targetTitle),
      }))
      .sort((left, right) => right.score - left.score);
  }

  private async resolveArtistIdByName(artistName: string) {
    const normalizedTarget = normalizeComparableArtistName(artistName);

    if (!normalizedTarget) {
      return null;
    }

    const localArtist = Object.values(useAppStore.getState().artists).find(
      (artist) => normalizeComparableArtistName(artist.name) === normalizedTarget,
    );

    if (localArtist) {
      return localArtist.id;
    }

    const matches = await musicBrainzService.searchArtist(artistName);
    const bestMatch = pickBestArtistMatch(artistName, matches);

    if (!bestMatch) {
      return null;
    }

    try {
      const artist = await musicBrainzService.getArtist(bestMatch.id);
      useAppStore.getState().hydrateArtists([artist]);
      await cacheService.set("artists", artist.id, artist);
      return artist.id;
    } catch {
      return null;
    }
  }

  private async findTrackCandidatesForReleaseTitle(
    title: string,
    release: Release,
    fallbackArtistName: string | undefined,
  ) {
    const normalizedTitle = normalizationService.normalizeTrackTitle(title);
    const releaseArtistName = release.artistName ?? fallbackArtistName;
    const normalizedArtist = releaseArtistName
      ? normalizationService.normalizeArtistName(extractPrimaryArtistName(releaseArtistName))
      : null;
    const localTracks = Object.values(useAppStore.getState().tracks);
    const localWinner = this.pickBestTrackCandidate(
      localTracks,
      normalizedTitle,
      normalizedArtist,
      release,
    );

    const searchedTracksById = new Map<string, Track>();
    const searchQueries = this.buildTrackQueryVariants(title, releaseArtistName);

    for (const query of searchQueries) {
      const result = await musicService.searchCandidateTracks(query);

      for (const track of result) {
        searchedTracksById.set(track.id, track);
      }
    }

    const searchedTracks = Array.from(searchedTracksById.values());
    const remoteWinner = this.pickBestTrackCandidate(
      searchedTracks,
      normalizedTitle,
      normalizedArtist,
      release,
    );

    const ranked = this.getRankedTrackCandidates(
      [...localTracks, ...searchedTracks].filter(
        (track, index, arr) => arr.findIndex((item) => item.id === track.id) === index,
      ),
      normalizedTitle,
      normalizedArtist,
      release,
    );

    if (remoteWinner && (!localWinner || remoteWinner.score > localWinner.score)) {
      return ranked;
    }

    if (!remoteWinner && !localWinner) {
      return [];
    }

    return ranked;
  }

  private async resolveReleaseTrackIds(
    release: Release,
    trackTitles: string[],
    fallbackArtistName: string | undefined,
  ) {
    const dedupedTitles = dedupeTrackTitles(trackTitles);
    const selectedByTitle = new Map<string, { trackId: string; score: number }>();
    const usedTrackIds = new Set<string>();
    const candidatesByTitle: Array<{
      originalTitle: string;
      normalizedTitle: string;
      candidates: Array<{ track: Track; score: number; titleSimilarity: number }>;
    }> = [];

    for (const title of dedupedTitles) {
      const normalizedTitle = normalizationService.normalizeTrackTitle(title);
      const candidates = await this.findTrackCandidatesForReleaseTitle(
        title,
        release,
        fallbackArtistName,
      );
      const filteredCandidates = candidates.filter(
        (candidate) => candidate.score >= MIN_ACCEPTABLE_SCORE,
      );
      const resolvedCandidates = filteredCandidates.length ? filteredCandidates : candidates;

      if (!resolvedCandidates.length) {
        continue;
      }

      candidatesByTitle.push({
        originalTitle: title,
        normalizedTitle,
        candidates: resolvedCandidates,
      });
    }

    candidatesByTitle.sort((left, right) => {
      const byOptions = left.candidates.length - right.candidates.length;

      if (byOptions !== 0) {
        return byOptions;
      }

      return right.candidates[0].score - left.candidates[0].score;
    });

    for (const item of candidatesByTitle) {
      const existing = selectedByTitle.get(item.normalizedTitle);
      const winner =
        item.candidates.find(
          (candidate) =>
            !usedTrackIds.has(candidate.track.id) && candidate.score >= MIN_ACCEPTABLE_SCORE,
        ) ??
        item.candidates.find(
          (candidate) =>
            !usedTrackIds.has(candidate.track.id) &&
            candidate.titleSimilarity >= MIN_TITLE_SIMILARITY_FALLBACK,
        ) ??
        item.candidates.find((candidate) => !usedTrackIds.has(candidate.track.id));

      if (!winner) {
        continue;
      }

      if (existing && winner.score <= existing.score) {
        continue;
      }

      if (existing) {
        usedTrackIds.delete(existing.trackId);
      }

      selectedByTitle.set(item.normalizedTitle, {
        trackId: winner.track.id,
        score: winner.score,
      });
      usedTrackIds.add(winner.track.id);
    }

    const matchedTrackIds = dedupedTitles
      .map((title) => selectedByTitle.get(normalizationService.normalizeTrackTitle(title))?.trackId)
      .filter((trackId): trackId is string => !!trackId);
    const unmatchedTitles = dedupedTitles.filter(
      (title) => !selectedByTitle.has(normalizationService.normalizeTrackTitle(title)),
    );

    if (unmatchedTitles.length) {
      console.warn("[release-match] partial result", {
        releaseId: release.id,
        releaseTitle: release.title,
        matched: matchedTrackIds.length,
        total: dedupedTitles.length,
        unmatchedTitles,
      });
    }

    return matchedTrackIds;
  }

  async resolveArtistIdForTrack(trackId: string, preferredArtistName?: string) {
    const resolutionKey = `${trackId}:${preferredArtistName?.trim().toLowerCase() ?? ""}`;
    const activeResolution = this.activeArtistResolutions.get(resolutionKey);

    if (activeResolution) {
      return activeResolution;
    }

    const task = (async () => {
      const track = useAppStore.getState().tracks[trackId];

      if (!track) {
        return null;
      }

      if (preferredArtistName?.trim()) {
        const preferredId = await this.resolveArtistIdByName(preferredArtistName);

        if (preferredId) {
          return preferredId;
        }
      }

      if (track.musicBrainzArtistId) {
        return track.musicBrainzArtistId;
      }

      const enrichedTrack = await metadataEnrichmentService.enrichTrack(trackId);
      if (enrichedTrack?.musicBrainzArtistId) {
        return enrichedTrack.musicBrainzArtistId;
      }

      const primaryArtistName = preferredArtistName?.trim()
        ? preferredArtistName
        : extractPrimaryArtistName(track.artist);
      const matches = await musicBrainzService.searchArtist(primaryArtistName);
      const bestMatch = pickBestArtistMatch(primaryArtistName, matches);

      if (!bestMatch) {
        return null;
      }

      try {
        const artist = await musicBrainzService.getArtist(bestMatch.id);
        useAppStore.getState().hydrateArtists([artist]);
        useAppStore.getState().setTrackMetadata(trackId, {
          musicBrainzArtistId: artist.id,
          normalizedArtistName: normalizationService.normalizeArtistName(primaryArtistName),
        });
        await cacheService.set("artists", artist.id, artist);
        return artist.id;
      } catch {
        return null;
      }
    })().finally(() => {
      this.activeArtistResolutions.delete(resolutionKey);
    });

    this.activeArtistResolutions.set(resolutionKey, task);
    return task;
  }

  async getArtistPageData(artistId: string) {
    const activeRequest = this.activeArtistPageRequests.get(artistId);

    if (activeRequest) {
      return activeRequest;
    }

    const task = (async () => {
      useAppStore.getState().setArtistStatus(artistId, "loading");
      let artist = useAppStore.getState().artists[artistId];

      if (!artist) {
        const cachedArtist = await cacheService.get<Artist>("artists", artistId);

        if (cachedArtist) {
          artist = cachedArtist;
          useAppStore.getState().hydrateArtists([cachedArtist]);
        }
      }

      if (!artist) {
        try {
          artist = await musicBrainzService.getArtist(artistId);
          useAppStore.getState().hydrateArtists([artist]);
          await cacheService.set("artists", artist.id, artist);
        } catch (error) {
          useAppStore.getState().setArtistStatus(artistId, "failed");
          throw error;
        }
      }

      const cacheKey = getArtistDiscographyCacheKey(artistId);
      const cachedDiscography = await cacheService.get<
        DiscographyCachePayload | { albums: Release[]; singles: Release[] }
      >("releases", cacheKey);
      const hasValidCachedDiscography =
        !!cachedDiscography &&
        "schemaVersion" in cachedDiscography &&
        cachedDiscography.schemaVersion === DISCOGRAPHY_CACHE_SCHEMA_VERSION;

      let albums: Release[] = hasValidCachedDiscography ? cachedDiscography.albums : [];
      let singles: Release[] = hasValidCachedDiscography ? cachedDiscography.singles : [];

      if (!hasValidCachedDiscography) {
        try {
          const freshDiscography = await musicBrainzService.getArtistDiscography(artistId);
          albums = freshDiscography.albums;
          singles = freshDiscography.singles;
          await cacheService.set("releases", cacheKey, {
            schemaVersion: DISCOGRAPHY_CACHE_SCHEMA_VERSION,
            albums,
            singles,
          } satisfies DiscographyCachePayload);
        } catch (error) {
          if (cachedDiscography && "albums" in cachedDiscography && "singles" in cachedDiscography) {
            albums = cachedDiscography.albums;
            singles = cachedDiscography.singles;
          } else {
            useAppStore.getState().setArtistStatus(artistId, "failed");
            throw error;
          }
        }
      }

      for (const release of [...albums, ...singles]) {
        useAppStore.getState().upsertRelease({
          ...release,
          artistId: artistId,
          artistName: release.artistName ?? artist.name,
        });
      }

      const knownTrackIds = getTracksForArtist(artistId).map((track) => track.id);
      mergeArtistTrackIds(artistId, knownTrackIds);
      void this.hydrateReleaseCovers(artistId, [...albums, ...singles], artist.name);

      useAppStore.getState().setArtistStatus(artistId, "ready");

      return {
        artist,
        albums,
        singles,
        tracks: getTracksForArtist(artistId),
      };
    })().finally(() => {
      this.activeArtistPageRequests.delete(artistId);
    });

    this.activeArtistPageRequests.set(artistId, task);
    return task;
  }

  async getReleasePageData(releaseId: string, artistId?: string) {
    const requestKey = `${artistId ?? ""}:${releaseId}`;
    const activeRequest = this.activeReleasePageRequests.get(requestKey);

    if (activeRequest) {
      return activeRequest;
    }

    const task = (async () => {
      useAppStore.getState().setReleaseStatus(releaseId, "loading");
      const cacheKey = getReleaseDetailsCacheKey(releaseId);
      const cachedPayload = await cacheService.get<
        ReleaseDetailsPayload | ReleaseDetailsCachePayload
      >("releases", cacheKey);
      const hasValidCachedPayload =
        !!cachedPayload &&
        "schemaVersion" in cachedPayload &&
        cachedPayload.schemaVersion === RELEASE_DETAILS_CACHE_SCHEMA_VERSION;

      if (hasValidCachedPayload) {
        const cachedRelease = {
          ...cachedPayload.release,
          artistId: cachedPayload.release.artistId ?? artistId,
          trackIds: cachedPayload.trackIds,
          trackTitles: cachedPayload.trackTitles,
        };
        const hydratedTracks = cachedPayload.trackIds
          .map((trackId) => useAppStore.getState().tracks[trackId])
          .filter((track): track is Track => !!track);

        useAppStore.getState().upsertRelease(cachedRelease);
        const coverage =
          cachedPayload.trackTitles.length > 0
            ? cachedPayload.trackIds.length / cachedPayload.trackTitles.length
            : 1;

        if ((hydratedTracks.length || !cachedPayload.trackIds.length) && coverage >= MIN_CACHED_MATCH_COVERAGE) {
          mergeArtistTrackIds(cachedRelease.artistId, cachedPayload.trackIds);
          useAppStore.getState().setReleaseStatus(releaseId, "ready");
          return {
            release: cachedRelease,
            tracks: hydratedTracks,
          };
        }
      }

      try {
        const { release: rawRelease, trackTitles } = await musicBrainzService.getReleaseTrackListing(
          releaseId,
        );
        const storeArtist = artistId ? useAppStore.getState().artists[artistId] : undefined;
        const release: Release = {
          ...rawRelease,
          artistId: artistId ?? rawRelease.artistId,
          artistName: rawRelease.artistName ?? storeArtist?.name,
        };
        const coverUrl = await coverArtService.resolveCoverUrl(
          release.musicBrainzReleaseId,
          release.coverUrl ?? "",
        );
        const trackIds = await this.resolveReleaseTrackIds(
          release,
          trackTitles,
          storeArtist?.name,
        );
        const finalRelease = {
          ...release,
          coverUrl,
          trackTitles,
          trackIds,
        };

        useAppStore.getState().upsertRelease(finalRelease);
        mergeArtistTrackIds(finalRelease.artistId, trackIds);
        useAppStore.getState().setReleaseStatus(releaseId, "ready");
        await cacheService.set("releases", cacheKey, {
          release: finalRelease,
          trackIds,
          trackTitles,
          schemaVersion: RELEASE_DETAILS_CACHE_SCHEMA_VERSION,
        } satisfies ReleaseDetailsCachePayload);

        return {
          release: finalRelease,
          tracks: trackIds
            .map((trackId) => useAppStore.getState().tracks[trackId])
            .filter((track): track is Track => !!track),
        };
      } catch (error) {
        useAppStore.getState().setReleaseStatus(releaseId, "failed");
        throw error;
      }
    })().finally(() => {
      this.activeReleasePageRequests.delete(requestKey);
    });

    this.activeReleasePageRequests.set(requestKey, task);
    return task;
  }

  getKnownTracks(artistId: string): Track[] {
    return getTracksForArtist(artistId);
  }
}

export const artistService = new ArtistService();
