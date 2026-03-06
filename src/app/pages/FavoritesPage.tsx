import { EmptyState } from "../components/EmptyState";
import { TrackList } from "../components/TrackList";
import { Track } from "../types";

interface FavoritesPageProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlay: (trackId: string, queueIds: string[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (trackId: string) => void;
  onShowLyrics: (trackId: string) => void;
}

export function FavoritesPage(props: FavoritesPageProps) {
  const hasFavorites = props.tracks.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-white">Избранное</h1>
        {hasFavorites ? <div className="text-sm text-white/45">{props.tracks.length} треков</div> : null}
      </div>

      {!hasFavorites ? (
        <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <p className="max-w-2xl text-sm leading-7 text-white/55">
            Каждый трек в избранном автоматически получает локальный статус скачивания. Повторной загрузки для уже скачанных треков не будет.
          </p>
        </section>
      ) : null}

      {hasFavorites ? (
        <TrackList {...props} reverseIndex />
      ) : (
        <EmptyState title="Нет избранных треков" description="Добавьте музыку в избранное, и треки будут сохраняться автоматически." />
      )}
    </div>
  );
}
