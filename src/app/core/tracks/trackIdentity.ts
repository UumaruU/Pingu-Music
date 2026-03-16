import { ProviderId, Track } from "../../types";
import { normalizeCoverUrl } from "../../services/coverUrlService";
import { normalizationService } from "../../services/normalizationService";
import { withSourceMetadata } from "../../services/sourceMetadataService";

export const DEFAULT_PROVIDER_ID: ProviderId = "hitmos";

export function withTrackProviderDefaults(track: Track): Track {
  const normalizedPresentation = normalizationService.normalizeTrackPresentation(track.title, track.artist);

  return withSourceMetadata({
    ...track,
    providerId: track.providerId ?? DEFAULT_PROVIDER_ID,
    providerTrackId: track.providerTrackId ?? track.id,
    title: normalizedPresentation.title || track.title,
    artist: normalizedPresentation.artist || track.artist,
    coverUrl: normalizeCoverUrl(track.coverUrl) || track.coverUrl,
  });
}

export function normalizeTracks<T extends Track>(tracks: T[]) {
  return tracks.map((track) => withTrackProviderDefaults(track)) as T[];
}

export function getProviderTrackId(track: Pick<Track, "id" | "providerTrackId">) {
  return track.providerTrackId ?? track.id;
}
