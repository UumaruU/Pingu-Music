import { Track } from "../types";
import { HitmosTrackDto, tauriBridge } from "../services/tauriBridge";
import { MusicProvider } from "./musicProvider";

function normalizeTrack(track: HitmosTrackDto): Track {
  return {
    ...track,
    coverUrl: track.coverUrl || "https://placehold.co/300x300?text=Pingu+Music",
    sourceUrl: track.sourceUrl || "https://rus.hitmotop.com",
    isFavorite: false,
    downloadState: "idle",
    metadataStatus: "raw",
  };
}

export class HitmosProvider implements MusicProvider {
  async getPopularTracks(): Promise<Track[]> {
    const tracks = await tauriBridge.getPopularHitmos();
    return tracks.map(normalizeTrack);
  }

  async searchTracks(query: string): Promise<Track[]> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return this.getPopularTracks();
    }

    const tracks = await tauriBridge.searchHitmos(normalizedQuery);
    return tracks.map(normalizeTrack);
  }
}
