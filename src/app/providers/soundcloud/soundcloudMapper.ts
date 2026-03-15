import { normalizeTracks } from "../../core/tracks/trackIdentity";
import { SoundcloudTrackDto } from "../../services/tauriBridge";
import { Track } from "../../types";

function mapTrack(track: SoundcloudTrackDto): Track {
  const providerTrackId = track.id.trim();

  return {
    id: `soundcloud:${providerTrackId}`,
    providerId: "soundcloud",
    providerTrackId,
    title: track.title,
    artist: track.artist,
    coverUrl: track.coverUrl || "https://placehold.co/300x300?text=SoundCloud",
    audioUrl: track.audioUrl || track.sourceUrl,
    duration: track.duration,
    sourceUrl: track.sourceUrl || track.audioUrl,
    isFavorite: false,
    downloadState: "idle",
    metadataStatus: "raw",
  };
}

export function mapSoundcloudTracks(tracks: SoundcloudTrackDto[]) {
  return normalizeTracks(tracks.map(mapTrack));
}