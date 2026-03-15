import { normalizeTracks } from "../../core/tracks/trackIdentity";
import { HitmosTrackDto } from "../../services/tauriBridge";
import { Track } from "../../types";

function mapTrack(track: HitmosTrackDto): Track {
  return {
    ...track,
    providerId: "hitmos",
    providerTrackId: track.id,
    coverUrl: track.coverUrl || "https://placehold.co/300x300?text=Pingu+Music",
    sourceUrl: track.sourceUrl || "https://rus.hitmotop.com",
    isFavorite: false,
    downloadState: "idle",
    metadataStatus: "raw",
  };
}

export function mapHitmosTracks(tracks: HitmosTrackDto[]) {
  return normalizeTracks(tracks.map(mapTrack));
}
