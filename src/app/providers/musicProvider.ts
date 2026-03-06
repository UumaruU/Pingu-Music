import { Track } from "../types";

export interface MusicProvider {
  getPopularTracks(): Promise<Track[]>;
  searchTracks(query: string): Promise<Track[]>;
}
