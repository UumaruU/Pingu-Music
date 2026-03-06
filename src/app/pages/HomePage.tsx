import { Flame, Sparkles } from "lucide-react";
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
            Музыка без лишнего шума: популярное, избранное и ваши плейлисты в одном окне.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/60">
            Pingu Music помогает быстро находить треки, собирать плейлисты и слушать музыку в удобном формате.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-100">
              <Flame size={20} />
            </div>
            <div className="text-lg font-semibold text-white">Популярное сейчас</div>
            <div className="mt-2 text-sm text-white/55">Пустой поиск автоматически показывает горячие треки из текущего каталога.</div>
          </div>
          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
            <div className="text-sm uppercase tracking-[0.25em] text-white/35">Автозагрузка</div>
            <div className="mt-3 text-lg font-semibold text-white">Избранное = скачивание</div>
            <div className="mt-2 text-sm text-white/55">Кнопки загрузки нет: скачивание стартует автоматически, когда трек попадает в избранное.</div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Популярные треки</h2>
            <p className="mt-1 text-sm text-white/50">Главная лента с актуальными треками.</p>
          </div>
        </div>
        {props.tracks.length ? (
          <TrackList {...props} />
        ) : (
          <EmptyState title="Здесь пока ничего нет" description="Каталог пуст. Обновите страницу или попробуйте позже." />
        )}
      </section>
    </div>
  );
}
