import { EmptyState } from "../components/EmptyState";
import { TrackList } from "../components/TrackList";
import { SearchStatus, Track } from "../types";

interface SearchPageProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlay: (trackId: string, queueIds: string[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (trackId: string) => void;
  onShowLyrics: (trackId: string) => void;
  query: string;
  status: SearchStatus;
  error: string | null;
  recentQueries: string[];
  onSelectRecentQuery: (query: string) => void;
}

export function SearchPage({
  query,
  status,
  error,
  recentQueries,
  onSelectRecentQuery,
  tracks,
  ...trackListProps
}: SearchPageProps) {
  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <h1 className="text-3xl font-semibold text-white">Поиск музыки</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
          Введите запрос, чтобы увидеть результаты поиска. При пустом запросе показываются
          популярные треки.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {recentQueries.length ? (
            recentQueries.map((recentQuery) => (
              <button
                key={recentQuery}
                type="button"
                onClick={() => onSelectRecentQuery(recentQuery)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-white"
              >
                {recentQuery}
              </button>
            ))
          ) : (
            <span className="text-sm text-white/40">Недавних запросов пока нет.</span>
          )}
        </div>
      </section>

      {status === "loading" ? (
        <EmptyState
          title="Загрузка..."
          description="Ищем треки и синхронизируем результаты поиска."
        />
      ) : null}

      {status === "error" ? (
        <EmptyState
          title="Не удалось выполнить поиск"
          description={error ?? "Попробуйте выполнить поиск позже."}
        />
      ) : null}

      {(status === "success" || (!query.trim() && tracks.length)) && tracks.length ? (
        <TrackList tracks={tracks} {...trackListProps} />
      ) : null}

      {status === "empty" ? (
        <EmptyState
          title="Ничего не найдено"
          description={`По запросу «${query}» результатов нет. Попробуйте другой запрос или исполнителя.`}
        />
      ) : null}

      {!query.trim() && status === "idle" && !tracks.length ? (
        <EmptyState
          title="Начните искать музыку"
          description="Введите запрос, чтобы увидеть результаты и популярные треки."
        />
      ) : null}
    </div>
  );
}
