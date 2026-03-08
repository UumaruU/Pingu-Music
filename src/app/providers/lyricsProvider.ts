import { Lyrics } from "../types";

export interface LyricsProvider {
  getLyrics(params: {
    trackId: string;
    title: string;
    artist: string;
    duration?: number;
  }): Promise<Lyrics | null>;
}
