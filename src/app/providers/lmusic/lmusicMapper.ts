import { normalizeTracks } from "../../core/tracks/trackIdentity";
import { LmusicTrackDto } from "../../services/tauriBridge";
import { Track } from "../../types";

function mapTrack(track: LmusicTrackDto): Track {
  const providerTrackId = track.id.trim();

  return {
    id: `lmusic:${providerTrackId}`,
    providerId: "lmusic",
    providerTrackId,
    title: track.title,
    artist: track.artist,
    coverUrl: track.coverUrl || "https://placehold.co/300x300?text=LMusic",
    audioUrl: track.audioUrl || track.sourceUrl,
    duration: track.duration,
    sourceUrl: track.sourceUrl || "https://lmusic.kz",
    isFavorite: false,
    downloadState: "idle",
    metadataStatus: "raw",
  };
}

export function mapLmusicTracks(tracks: LmusicTrackDto[]) {
  return normalizeTracks(tracks.map(mapTrack));
}
