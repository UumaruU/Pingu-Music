import { Flame, Radio, Sparkles } from "lucide-react";
import { RecommendationPreview } from "../components/RecommendationPreview";
import { EmptyState } from "../components/EmptyState";
import { TrackList } from "../components/TrackList";
import { Track } from "../types";

interface HomePageProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlay: (trackId: string, queueIds: string[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (trackId: string) => void;
  onShowLyrics: (trackId: string) => void;
  onOpenArtist: (trackId: string, artistName?: string) => void;
  onOpenStream: () => void;
  onOpenLogin: () => void;
}

export function HomePage(props: HomePageProps) {
  return (
    <div className="space-y-8">
      <section className="grid gap-4 rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.18),transparent_32%),linear-gradient(135deg,#111827,#0b0d12_58%,#0f172a)] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.45)] lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-cyan-100/80">
            <Sparkles size={14} />
            Подборка дня
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-white">
            Музыка без лишнего шума: популярное, избранное и персональные рекомендации в одном окне.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/60">
            Pingu Music теперь умеет не только искать и хранить треки, но и строить живой рекомендательный поток с канонизацией, графом связей и affinity-сигналами.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={props.onOpenStream}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-300/14 px-5 py-3 text-sm font-medium text-cyan-50 transition hover:bg-cyan-300/20"
            >
              <Radio size={16} />
              Открыть поток
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-100">
              <Flame size={20} />
            </div>
            <div className="text-lg font-semibold text-white">Популярное сейчас</div>
            <div className="mt-2 text-sm text-white/55">
              Пустой поиск автоматически показывает горячие треки из текущего каталога.
            </div>
          </div>
          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
            <div className="text-sm uppercase tracking-[0.25em] text-white/35">Рекомендации</div>
            <div className="mt-3 text-lg font-semibold text-white">Поток и autoplay</div>
            <div className="mt-2 text-sm text-white/55">
              После конца очереди и на отдельной странице плеер продолжает музыку через recommendation engine.
            </div>
          </div>
        </div>
      </section>

      <RecommendationPreview
        currentTrackId={props.currentTrackId}
        isPlaying={props.isPlaying}
        onPlay={props.onPlay}
        onToggleFavorite={props.onToggleFavorite}
        onAddToPlaylist={props.onAddToPlaylist}
        onShowLyrics={props.onShowLyrics}
        onOpenArtist={props.onOpenArtist}
        onOpenStream={props.onOpenStream}
        onOpenLogin={props.onOpenLogin}
      />

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Популярные треки</h2>
            <p className="mt-1 text-sm text-white/50">Главная лента с актуальными треками каталога.</p>
          </div>
        </div>
        {props.tracks.length ? (
          <TrackList
            tracks={props.tracks}
            currentTrackId={props.currentTrackId}
            isPlaying={props.isPlaying}
            onPlay={props.onPlay}
            onToggleFavorite={props.onToggleFavorite}
            onAddToPlaylist={props.onAddToPlaylist}
            onShowLyrics={props.onShowLyrics}
            onOpenArtist={props.onOpenArtist}
          />
        ) : (
          <EmptyState
            title="Здесь пока ничего нет"
            description="Каталог пуст. Обновите страницу или попробуйте позже."
          />
        )}
      </section>
    </div>
  );
}
