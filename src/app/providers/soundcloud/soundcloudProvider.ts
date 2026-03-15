import { MusicProvider } from "../../core/providers/providerTypes";
import { useAppStore } from "../../store/appStore";
import { tauriBridge } from "../../services/tauriBridge";
import { Track } from "../../types";
import { mapSoundcloudTracks } from "./soundcloudMapper";

class SoundcloudProvider implements MusicProvider {
  readonly id = "soundcloud" as const;

  private readonly knownTracks = new Map<string, string>();

  private rememberSources(tracks: ReturnType<typeof mapSoundcloudTracks>) {
    tracks.forEach((track) => {
      const sourceUrl = track.sourceUrl || track.audioUrl;

      if (sourceUrl) {
        this.knownTracks.set(track.providerTrackId ?? track.id, sourceUrl);
      }
    });
  }

  async search(query: string): Promise<Track[]> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return [];
    }

    const tracks = mapSoundcloudTracks(await tauriBridge.searchSoundcloud(normalizedQuery));
    this.rememberSources(tracks);
    return tracks;
  }

  async getStream(trackId: string): Promise<string> {
    const knownSource = this.knownTracks.get(trackId);

    if (knownSource) {
      return tauriBridge.resolveSoundcloudStream(knownSource);
    }

    const storeTrack = Object.values(useAppStore.getState().tracks).find(
      (track) =>
        track.providerId === this.id && (track.providerTrackId ?? track.id) === trackId,
    );

    const sourceUrl = storeTrack?.sourceUrl || storeTrack?.audioUrl;

    if (sourceUrl) {
      this.knownTracks.set(trackId, sourceUrl);
      return tauriBridge.resolveSoundcloudStream(sourceUrl);
    }

    throw new Error(`SoundCloud source URL for "${trackId}" is not cached yet.`);
  }
}

export function createProvider() {
  return new SoundcloudProvider();
}