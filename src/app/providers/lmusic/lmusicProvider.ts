import { MusicProvider } from "../../core/providers/providerTypes";
import { useAppStore } from "../../store/appStore";
import { tauriBridge } from "../../services/tauriBridge";
import { Track } from "../../types";
import { mapLmusicTracks } from "./lmusicMapper";

class LmusicProvider implements MusicProvider {
  readonly id = "lmusic" as const;

  private readonly knownTracks = new Map<string, string>();

  private rememberStreams(tracks: ReturnType<typeof mapLmusicTracks>) {
    tracks.forEach((track) => {
      if (track.audioUrl) {
        this.knownTracks.set(track.providerTrackId ?? track.id, track.audioUrl);
      }
    });
  }

  async search(query: string): Promise<Track[]> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return [];
    }

    const tracks = mapLmusicTracks(await tauriBridge.searchLmusic(normalizedQuery));
    this.rememberStreams(tracks);
    return tracks;
  }

  async getStream(trackId: string): Promise<string> {
    const knownStream = this.knownTracks.get(trackId);

    if (knownStream) {
      return knownStream;
    }

    const storeTrack = Object.values(useAppStore.getState().tracks).find(
      (track) =>
        track.providerId === this.id && (track.providerTrackId ?? track.id) === trackId,
    );

    if (storeTrack?.audioUrl) {
      this.knownTracks.set(trackId, storeTrack.audioUrl);
      return storeTrack.audioUrl;
    }

    throw new Error(`LMusic stream URL for "${trackId}" is not cached yet.`);
  }
}

export function createProvider() {
  return new LmusicProvider();
}
