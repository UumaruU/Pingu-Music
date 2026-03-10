import { History } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { TrackList } from "../components/TrackList";
import { Track } from "../types";

interface ListenHistorySection {
  dayKey: string;
  tracks: Track[];
}

interface HistoryPageProps {
  sections: ListenHistorySection[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlay: (trackId: string, queueIds: string[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (trackId: string) => void;
  onShowLyrics: (trackId: string) => void;
  onOpenArtist: (trackId: string, artistName?: string) => void;
}

function parseDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function dayStartTimestamp(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatHistoryDayLabel(dayKey: string) {
  const date = parseDayKey(dayKey);

  if (!date) {
    return dayKey;
  }

  const todayStart = dayStartTimestamp(new Date());
  const dayStart = dayStartTimestamp(date);
  const diffDays = Math.round((todayStart - dayStart) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) {
    return "Сегодня";
  }

  if (diffDays === 1) {
    return "Вчера";
  }

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function HistoryPage(props: HistoryPageProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/14 text-cyan-100">
          <History size={20} />
        </div>
        <div>
          <h1 className="text-3xl font-semibold text-white">История</h1>
          <p className="mt-1 text-sm text-white/50">
            Трек попадает сюда после 50% прослушивания. Записи старше 60 дней удаляются
            автоматически.
          </p>
        </div>
      </div>

      {props.sections.length ? (
        <div className="space-y-7">
          {props.sections.map((section) => (
            <section key={section.dayKey}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white/95">
                  {formatHistoryDayLabel(section.dayKey)}
                </h2>
                <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                  {section.tracks.length} треков
                </div>
              </div>
              <TrackList
                tracks={section.tracks}
                currentTrackId={props.currentTrackId}
                isPlaying={props.isPlaying}
                onPlay={props.onPlay}
                onToggleFavorite={props.onToggleFavorite}
                onAddToPlaylist={props.onAddToPlaylist}
                onShowLyrics={props.onShowLyrics}
                onOpenArtist={props.onOpenArtist}
              />
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title="История пока пустая"
          description="Включите любой трек и прослушайте его хотя бы наполовину."
        />
      )}
    </div>
  );
}
