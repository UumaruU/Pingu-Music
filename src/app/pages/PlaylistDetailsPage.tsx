import { ArrowLeft } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { TrackList } from "../components/TrackList";
import { Playlist, Track } from "../types";

interface PlaylistDetailsPageProps {
  playlist: Playlist | undefined;
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlay: (trackId: string, queueIds: string[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (trackId: string) => void;
  onShowLyrics: (trackId: string) => void;
  onRemoveFromPlaylist: (trackId: string) => void;
  onBack: () => void;
}

export function PlaylistDetailsPage({
  playlist,
  tracks,
  onBack,
  onRemoveFromPlaylist,
  ...trackListProps
}: PlaylistDetailsPageProps) {
  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-white"
        >
          <ArrowLeft size={16} />
          Назад к плейлистам
        </button>
        <h1 className="text-3xl font-semibold text-white">{playlist?.name ?? "Плейлист не найден"}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
          {playlist
            ? `В плейлисте ${playlist.trackIds.length} треков. Здесь можно запускать очередь и убирать лишние позиции.`
            : "Возможно, плейлист был удалён или ссылка больше не актуальна."}
        </p>
      </section>

      {playlist && tracks.length ? (
        <TrackList {...trackListProps} tracks={tracks} onRemoveFromPlaylist={onRemoveFromPlaylist} />
      ) : (
        <EmptyState
          title={playlist ? "Плейлист пока пуст" : "Плейлист не найден"}
          description={playlist ? "Добавьте сюда музыку из главной страницы, поиска или избранного." : "Вернитесь в список плейлистов и откройте существующую подборку."}
        />
      )}
    </div>
  );
}
