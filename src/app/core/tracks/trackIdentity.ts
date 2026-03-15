import { ProviderId, Track } from "../../types";

export const DEFAULT_PROVIDER_ID: ProviderId = "hitmos";

export function withTrackProviderDefaults(track: Track): Track {
  return {
    ...track,
    providerId: track.providerId ?? DEFAULT_PROVIDER_ID,
    providerTrackId: track.providerTrackId ?? track.id,
  };
}

export function normalizeTracks<T extends Track>(tracks: T[]) {
  return tracks.map((track) => withTrackProviderDefaults(track)) as T[];
}

export function getProviderTrackId(track: Pick<Track, "id" | "providerTrackId">) {
  return track.providerTrackId ?? track.id;
}
