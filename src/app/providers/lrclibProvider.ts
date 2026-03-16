import { Lyrics } from "../types";
import { normalizationService } from "../services/normalizationService";
import { LyricsProvider } from "./lyricsProvider";

interface LrclibTrackDto {
  id: number;
  trackName: string;
  artistName: string;
  duration: number;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

function buildSearchUrl(title: string, artist: string) {
  const url = new URL("https://lrclib.net/api/search");
  url.searchParams.set("q", `${artist} ${title}`.trim());
  return url.toString();
}

function tokenize(value: string) {
  return normalizationService
    .normalizeComparisonText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function getTokenOverlap(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let overlap = 0;

  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  });

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function scoreTitleMatch(title: string, candidateTitle: string) {
  const normalizedTitle = normalizationService.normalizeTrackTitleCore(title);
  const normalizedCandidateTitle = normalizationService.normalizeTrackTitleCore(candidateTitle);
  const titleSignature = normalizationService.buildLooseSignature(title);
  const candidateSignature = normalizationService.buildLooseSignature(candidateTitle);

  if (normalizedTitle && normalizedTitle === normalizedCandidateTitle) {
    return 6;
  }

  if (
    normalizedTitle &&
    normalizedCandidateTitle &&
    (normalizedTitle.includes(normalizedCandidateTitle) ||
      normalizedCandidateTitle.includes(normalizedTitle))
  ) {
    return 4;
  }

  if (titleSignature && titleSignature === candidateSignature) {
    return 3.5;
  }

  const tokenOverlap = getTokenOverlap(title, candidateTitle);

  if (tokenOverlap >= 0.75) {
    return 2.5;
  }

  if (tokenOverlap >= 0.5) {
    return 1.25;
  }

  return -2;
}

function scoreArtistMatch(artist: string, candidateArtist: string) {
  const normalizedArtist = normalizationService.normalizeArtistCore(artist);
  const normalizedCandidateArtist = normalizationService.normalizeArtistCore(candidateArtist);
  const artistSignature = normalizationService.buildLooseSignature(artist);
  const candidateSignature = normalizationService.buildLooseSignature(candidateArtist);

  if (normalizedArtist && normalizedArtist === normalizedCandidateArtist) {
    return 5;
  }

  if (
    normalizedArtist &&
    normalizedCandidateArtist &&
    (normalizedArtist.includes(normalizedCandidateArtist) ||
      normalizedCandidateArtist.includes(normalizedArtist))
  ) {
    return 3.5;
  }

  if (artistSignature && artistSignature === candidateSignature) {
    return 2.5;
  }

  const tokenOverlap = getTokenOverlap(artist, candidateArtist);

  if (tokenOverlap >= 0.75) {
    return 2;
  }

  if (tokenOverlap >= 0.5) {
    return 1;
  }

  return -2.5;
}

function scoreDurationMatch(expectedDuration: number | undefined, candidateDuration: number) {
  if (!expectedDuration) {
    return 0;
  }

  const delta = Math.abs(candidateDuration - expectedDuration);

  if (delta <= 2) {
    return 2;
  }

  if (delta <= 4) {
    return 1;
  }

  if (delta <= 8) {
    return 0;
  }

  return -2.5;
}

function compareCandidates(
  left: { candidate: LrclibTrackDto; score: number },
  right: { candidate: LrclibTrackDto; score: number },
) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  const leftHasSynced = left.candidate.syncedLyrics ? 1 : 0;
  const rightHasSynced = right.candidate.syncedLyrics ? 1 : 0;

  if (leftHasSynced !== rightHasSynced) {
    return rightHasSynced - leftHasSynced;
  }

  return left.candidate.id - right.candidate.id;
}

export class LrclibProvider implements LyricsProvider {
  async getLyrics(params: {
    trackId: string;
    title: string;
    artist: string;
    duration?: number;
  }): Promise<Lyrics | null> {
    const response = await fetch(buildSearchUrl(params.title, params.artist), {
      headers: {
        "User-Agent": "PinguMusic/0.1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`LRCLIB returned ${response.status}`);
    }

    const candidates = (await response.json()) as LrclibTrackDto[];
    const rankedCandidates = candidates
      .filter((candidate) => candidate.plainLyrics || candidate.syncedLyrics)
      .map((candidate) => ({
        candidate,
        score:
          scoreTitleMatch(params.title, candidate.trackName) +
          scoreArtistMatch(params.artist, candidate.artistName) +
          scoreDurationMatch(params.duration, candidate.duration),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort(compareCandidates);

    const bestMatch = rankedCandidates[0]?.candidate;

    if (!bestMatch) {
      return null;
    }

    return {
      trackId: params.trackId,
      plain: bestMatch.plainLyrics ?? undefined,
      synced: bestMatch.syncedLyrics ?? undefined,
      source: "LRCLIB",
      status: "ready",
    };
  }
}
