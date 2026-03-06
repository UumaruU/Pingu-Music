import { Track } from "../types";
import { TrackRow } from "./TrackRow";

interface TrackListProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  reverseIndex?: boolean;
  onPlay: (trackId: string, queueIds: string[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (trackId: string) => void;
  onShowLyrics: (trackId: string) => void;
  onRemoveFromPlaylist?: (trackId: string) => void;
}

export function TrackList({
  tracks,
  currentTrackId,
  isPlaying,
  reverseIndex = false,
  onPlay,
  onToggleFavorite,
  onAddToPlaylist,
  onShowLyrics,
  onRemoveFromPlaylist,
}: TrackListProps) {
  const queueIds = tracks.map((track) => track.id);

  return (
    <div className="space-y-0.5">
      {tracks.map((track, index) => (
        <TrackRow
          key={track.id}
          index={reverseIndex ? tracks.length - index : index + 1}
          track={track}
          isActive={currentTrackId === track.id}
          isPlaying={currentTrackId === track.id && isPlaying}
          onPlay={() => onPlay(track.id, queueIds)}
          onToggleFavorite={() => onToggleFavorite(track.id)}
          onAddToPlaylist={() => onAddToPlaylist(track.id)}
          onShowLyrics={() => onShowLyrics(track.id)}
          onRemoveFromPlaylist={onRemoveFromPlaylist ? () => onRemoveFromPlaylist(track.id) : undefined}
        />
      ))}
    </div>
  );
}
