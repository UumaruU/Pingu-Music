import { ArrowLeft, Disc3 } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { TrackList } from "../components/TrackList";
import { Artist, EntityLoadStatus, Release, Track } from "../types";

interface ReleasePageProps {
  release: Release | undefined;
  artist: Artist | undefined;
  tracks: Track[];
  status: EntityLoadStatus;
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlay: (trackId: string, queueIds: string[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (trackId: string) => void;
  onShowLyrics: (trackId: string) => void;
  onOpenArtist: (trackId: string, artistName?: string) => void;
  onBack: () => void;
}

function getReleaseKindLabel(kind: Release["kind"]) {
  if (kind === "album") {
    return "Альбом";
  }

  if (kind === "single") {
    return "Сингл";
  }

  return "Релиз";
}

export function ReleasePage({
  release,
  artist,
  tracks,
  status,
  onBack,
  ...trackListProps
}: ReleasePageProps) {
  const coverUrl = release?.coverUrl || tracks[0]?.coverUrl || "";

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.13),transparent_34%),linear-gradient(135deg,#101722,#0b0d12_60%,#111827)] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.4)] lg:p-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,620px)] md:items-start">
          <div className="min-w-0 space-y-4">
            <button
              type="button"
              onClick={onBack}
              className="self-start inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-sm text-white/70 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-white"
            >
              <ArrowLeft size={16} />
              Назад
            </button>

            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-100">
              <Disc3 size={14} />
              {getReleaseKindLabel(release?.kind)}
            </div>
            <h1 className="truncate text-3xl font-semibold text-white">
              {release?.title || (status === "loading" ? "Загрузка релиза..." : "Релиз не найден")}
            </h1>
            <p className="mt-2 text-sm text-white/55">
              {artist?.name || release?.artistName || "Исполнитель неизвестен"}
            </p>
          </div>

          <div className="grid gap-3 self-start md:min-h-[220px] md:grid-cols-[minmax(0,1fr)_220px] xl:grid-cols-[minmax(0,1fr)_250px]">
            <div className="grid gap-3 self-end sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-white/40">Дата</div>
                <div className="mt-2 text-sm text-white">{release?.date || "Неизвестно"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-white/40">Страна</div>
                <div className="mt-2 text-sm text-white">{release?.country || "Неизвестно"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-white/40">Треки</div>
                <div className="mt-2 text-sm text-white">{tracks.length}</div>
              </div>
            </div>

            <div className="w-full self-start">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                <div className="aspect-square w-full bg-white/[0.04]">
                  {coverUrl ? (
                    <ImageWithFallback
                      src={coverUrl}
                      alt={release?.title || "Обложка релиза"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-cyan-100/70">
                      <Disc3 size={36} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {status === "loading" ? (
        <EmptyState
          title="Загрузка релиза..."
          description="Сопоставляем треки из MusicBrainz с доступными треками в источнике."
        />
      ) : tracks.length ? (
        <TrackList tracks={tracks} {...trackListProps} />
      ) : (
        <EmptyState
          title={status === "failed" ? "Не удалось открыть релиз" : "Треки не найдены"}
          description={
            status === "failed"
              ? "Не получилось загрузить треки релиза. Попробуйте открыть релиз позже."
              : "По названиям треков релиза пока не найдено подходящих совпадений."
          }
        />
      )}
    </div>
  );
}
