import { LyricsProvider } from "./lyricsProvider";
import { Lyrics } from "../types";

interface LrclibTrackDto {
  id: number;
  trackName: string;
  artistName: string;
  duration: number;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

function normalizeCompare(value: string) {
  return value.trim().toLowerCase();
}

function buildSearchUrl(title: string, artist: string) {
  const url = new URL("https://lrclib.net/api/search");
  url.searchParams.set("q", `${artist} ${title}`.trim());
  return url.toString();
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
    const normalizedTitle = normalizeCompare(params.title);
    const normalizedArtist = normalizeCompare(params.artist);

    const exactCandidates = candidates.filter((candidate) => {
      const titleMatches = normalizeCompare(candidate.trackName) === normalizedTitle;
      const artistMatches = normalizeCompare(candidate.artistName).includes(normalizedArtist);

      if (!titleMatches || !artistMatches) {
        return false;
      }

      if (!params.duration) {
        return true;
      }

      return Math.abs(candidate.duration - params.duration) <= 4;
    });

    const bestMatch =
      exactCandidates.find((candidate) => !!candidate.syncedLyrics) ??
      exactCandidates[0] ??
      candidates.find((candidate) => !!candidate.syncedLyrics) ??
      candidates[0];

    if (!bestMatch || (!bestMatch.plainLyrics && !bestMatch.syncedLyrics)) {
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
