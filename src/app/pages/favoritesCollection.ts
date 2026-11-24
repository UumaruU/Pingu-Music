import { Playlist, Track } from "../types";

export const FAVORITE_TRACK_PREVIEW_LIMIT = 8;

export type CollectionSectionId = "liked-tracks" | "favorite-artists" | "playlists";

export type CollectionSection = {
  id: CollectionSectionId;
  title: string;
  count: number;
};

export function getFavoriteTrackPreview(
  tracks: Track[],
  limit = FAVORITE_TRACK_PREVIEW_LIMIT,
) {
  return tracks.slice(0, limit);
}

export function buildCollectionSections({
  favoriteTracks,
  favoriteArtistCount,
  playlists,
}: {
  favoriteTracks: Track[];
  favoriteArtistCount: number;
  playlists: Playlist[];
}): CollectionSection[] {
  return [
    {
      id: "liked-tracks",
      title: "Мне нравится",
      count: favoriteTracks.length,
    },
    {
      id: "favorite-artists",
      title: "Любимые артисты",
      count: favoriteArtistCount,
    },
    {
      id: "playlists",
      title: "Плейлисты",
      count: playlists.length,
    },
  ];
}
