import { DiscoverableMusicProvider } from "../../core/providers/providerTypes";
import { useAppStore } from "../../store/appStore";
import { tauriBridge } from "../../services/tauriBridge";
import { mapHitmosTracks } from "./hitmosMapper";

export class HitmosProvider implements DiscoverableMusicProvider {
  readonly id = "hitmos" as const;

  private readonly knownTracks = new Map<string, string>();

  private rememberStreams(tracks: ReturnType<typeof mapHitmosTracks>) {
    tracks.forEach((track) => {
      if (track.audioUrl) {
        this.knownTracks.set(track.providerTrackId ?? track.id, track.audioUrl);
      }
    });
  }

  async getPopular() {
    const tracks = mapHitmosTracks(await tauriBridge.getPopularHitmos());
    this.rememberStreams(tracks);
    return tracks;
  }

  async search(query: string) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return this.getPopular();
    }

    const tracks = mapHitmosTracks(await tauriBridge.searchHitmos(normalizedQuery));
    this.rememberStreams(tracks);
    return tracks;
  }

  async getStream(trackId: string) {
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

    throw new Error(`Hitmos stream URL for "${trackId}" is not cached yet.`);
  }
}

export function createProvider() {
  return new HitmosProvider();
}
