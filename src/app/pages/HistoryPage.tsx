import {
  Activity,
  CalendarDays,
  Clock3,
  Flame,
  History,
  Library,
  ListMusic,
  Play,
  Radio,
  RotateCcw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { TrackList } from "../components/TrackList";
import { Track } from "../types";
import { formatDuration } from "../utils/format";

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

function getPrimaryArtist(track: Track) {
  return track.artist.split(/[,/&]/)[0]?.trim() || track.artist.trim();
}

function getAllHistoryTracks(sections: ListenHistorySection[]) {
  return sections.flatMap((section) => section.tracks);
}

function getTopArtist(tracks: Track[]) {
  const counts = new Map<string, number>();

  tracks.forEach((track) => {
    const artist = getPrimaryArtist(track);
    if (!artist) {
      return;
    }
    counts.set(artist, (counts.get(artist) ?? 0) + 1);
  });

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "Пока нет";
}

function SectionHeader({
  title,
  caption,
}: {
  title: string;
  caption?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {caption ? <p className="mt-1 text-sm text-white/45">{caption}</p> : null}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "white",
}: {
  icon: typeof History;
  label: string;
  value: string;
  detail: string;
  tone?: "white" | "green" | "purple" | "pink";
}) {
  const toneClass = {
    white: "bg-white text-black",
    green: "bg-[var(--im-green)] text-black",
    purple: "bg-[var(--im-purple)] text-black",
    pink: "bg-[var(--im-pink)] text-black",
  }[tone];

  return (
    <div className="inspires-lift rounded-[22px] border border-white/[0.06] bg-white/[0.026] p-4">
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-[17px] ${toneClass}`}>
        <Icon size={18} />
      </div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-white/35">{label}</div>
      <div className="mt-2 truncate text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-white/42">{detail}</div>
    </div>
  );
}

function RecentTrackCard({
  track,
  index,
  queueIds,
  onPlay,
}: {
  track: Track;
  index: number;
  queueIds: string[];
  onPlay: (trackId: string, queueIds: string[]) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPlay(track.id, queueIds)}
      className="inspires-focus-ring inspires-lift group rounded-[24px] border border-white/[0.06] bg-white/[0.026] p-3 text-left"
    >
      <div className="relative overflow-hidden rounded-[20px]">
        <ImageWithFallback src={track.coverUrl} alt={track.title} className="aspect-square w-full object-cover" />
        <span className="absolute left-3 top-3 rounded-full bg-black/44 px-2 py-1 text-[11px] text-white/72 backdrop-blur">
          #{index + 1}
        </span>
        <span className="absolute inset-0 flex items-center justify-center bg-black/38 opacity-0 transition group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black">
            <Play size={17} className="fill-black" />
          </span>
        </span>
      </div>
      <div className="mt-3 min-w-0">
        <div className="truncate text-sm font-semibold text-white">{track.title}</div>
        <div className="mt-1 truncate text-xs text-white/43">{track.artist}</div>
      </div>
    </button>
  );
}

function TimelineMarker({ index }: { index: number }) {
  const colors = ["bg-white", "bg-[var(--im-green)]", "bg-[var(--im-purple)]", "bg-[var(--im-pink)]"];

  return (
    <div className="flex flex-col items-center">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${colors[index % colors.length]} text-xs font-semibold text-black`}>
        {index + 1}
      </div>
      <div className="mt-2 h-full min-h-[32px] w-px bg-white/[0.08]" />
    </div>
  );
}

function InsightCard({
  icon: Icon,
  title,
  caption,
  artworkClass,
}: {
  icon: typeof History;
  title: string;
  caption: string;
  artworkClass: string;
}) {
  return (
    <div className="inspires-lift rounded-[24px] border border-white/[0.06] bg-white/[0.026] p-4">
      <div className={`inspires-artwork ${artworkClass} mb-4 aspect-[1.55/1] rounded-[20px]`}>
        <div className="absolute left-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/34 text-white backdrop-blur">
          <Icon size={18} />
        </div>
      </div>
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-1 text-xs leading-5 text-white/43">{caption}</div>
    </div>
  );
}

function EmptyHistoryPanel() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="relative overflow-hidden rounded-[30px] border border-white/[0.07] bg-[radial-gradient(circle_at_18%_10%,rgba(20,216,255,0.24),transparent_30%),radial-gradient(circle_at_88%_0%,rgba(181,60,255,0.22),transparent_32%),linear-gradient(135deg,rgba(16,17,20,0.94),rgba(5,5,5,0.96))] p-6 shadow-[var(--im-shadow)] sm:p-7">
        <div className="absolute -right-20 bottom-[-100px] h-72 w-72 rotate-[-12deg] rounded-[64px] border border-white/[0.08] bg-black/24" />
        <div className="relative z-10 max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.11] bg-white/[0.05] px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-white/64">
            <History size={14} />
            listening log
          </div>
          <h1 className="text-3xl font-semibold leading-tight tracking-[-0.01em] text-white sm:text-5xl">
            История прослушивания пока пустая
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/58">
            Трек попадёт сюда после заметного прослушивания. Эти события помогают backend отличать случайный запуск от настоящего интереса.
          </p>
        </div>
      </div>
      <EmptyState
        title="Нет событий"
        description="Включите любой трек и прослушайте его хотя бы наполовину, чтобы появилась первая запись."
      />
    </div>
  );
}

export function HistoryPage(props: HistoryPageProps) {
  const allTracks = getAllHistoryTracks(props.sections);
  const uniqueTrackCount = new Set(allTracks.map((track) => track.id)).size;
  const uniqueArtistCount = new Set(allTracks.map(getPrimaryArtist).filter(Boolean)).size;
  const totalDuration = allTracks.reduce((sum, track) => sum + Math.max(0, track.duration || 0), 0);
  const mostRecentTracks = allTracks.slice(0, 6);
  const mostRecentQueueIds = mostRecentTracks.map((track) => track.id);
  const topArtist = getTopArtist(allTracks);

  if (!props.sections.length) {
    return (
      <div className="space-y-6">
        <EmptyHistoryPanel />
        <section className="grid gap-4 md:grid-cols-3">
          <InsightCard
            icon={Activity}
            title="Taste signals"
            caption="Будущие события прослушивания будут усиливать профиль вкуса."
            artworkClass="inspires-artwork-green"
          />
          <InsightCard
            icon={RotateCcw}
            title="Recent filters"
            caption="Недавно прослушанное не должно доминировать в рекомендациях."
            artworkClass="inspires-artwork-pink"
          />
          <InsightCard
            icon={Radio}
            title="Session context"
            caption="История поможет продолжать музыкальную сессию аккуратнее."
            artworkClass="inspires-artwork-amber"
          />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.01em] text-white sm:text-4xl">История</h1>
          <p className="mt-2 text-sm text-white/45">
            Последние прослушивания, которые уже работают как taste-сигналы для рекомендаций.
          </p>
        </div>
        {mostRecentTracks[0] ? (
          <button
            type="button"
            onClick={() => props.onPlay(mostRecentTracks[0].id, mostRecentQueueIds)}
            className="inspires-focus-ring inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            <Play size={16} className="fill-black" />
            Повторить последнее
          </button>
        ) : null}
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.12fr_0.88fr]">
        <div className="relative overflow-hidden rounded-[30px] border border-white/[0.07] bg-[radial-gradient(circle_at_12%_8%,rgba(55,212,107,0.23),transparent_30%),radial-gradient(circle_at_86%_0%,rgba(20,216,255,0.23),transparent_32%),linear-gradient(135deg,rgba(16,17,20,0.94),rgba(5,5,5,0.96))] p-5 shadow-[var(--im-shadow)] sm:p-6">
          <div className="grid gap-5 sm:grid-cols-[210px_1fr]">
            <div className="grid aspect-square grid-cols-2 gap-2 rounded-[28px] border border-white/[0.07] bg-black/20 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
              {mostRecentTracks.slice(0, 4).map((track) => (
                <ImageWithFallback key={track.id} src={track.coverUrl} alt={track.title} className="h-full w-full rounded-[20px] object-cover" />
              ))}
              {mostRecentTracks.length < 4
                ? Array.from({ length: 4 - mostRecentTracks.length }).map((_, index) => (
                    <div key={`placeholder-${index}`} className="inspires-artwork inspires-artwork-green rounded-[20px]" />
                  ))
                : null}
            </div>
            <div className="flex min-w-0 flex-col justify-between">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.11] bg-white/[0.05] px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-white/64">
                  <CalendarDays size={14} />
                  recent sessions
                </div>
                <h2 className="text-3xl font-semibold leading-tight tracking-[-0.01em] text-white sm:text-4xl">
                  Карта того, что звучало недавно
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-6 text-white/58">
                  Записи старше 60 дней очищаются автоматически, а свежие прослушивания помогают фильтровать повторы и подбирать следующий контекст.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2 text-xs text-white/50">
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">{props.sections.length} дней</span>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">{allTracks.length} событий</span>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">{formatDuration(totalDuration)} музыки</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="inspires-panel rounded-[26px] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[17px] bg-[var(--im-green)] text-black">
                <Flame size={19} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Главный артист</div>
                <div className="mt-1 text-xs text-white/43">Чаще всего встречается в истории</div>
              </div>
            </div>
            <div className="mt-5 rounded-[18px] border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/34">Сейчас лидирует</div>
              <div className="mt-2 truncate text-2xl font-semibold text-white">{topArtist}</div>
            </div>
          </div>

          <div className="inspires-panel rounded-[26px] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[17px] bg-white text-black">
                <Clock3 size={19} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Retention window</div>
                <div className="mt-1 text-xs text-white/43">Локальная история хранит свежий контекст</div>
              </div>
            </div>
            <div className="mt-5 rounded-[18px] border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/34">Окно</div>
              <div className="mt-2 text-3xl font-semibold text-white">60 дней</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={History} label="События" value={String(allTracks.length)} detail="прослушиваний в истории" tone="white" />
        <StatCard icon={ListMusic} label="Треки" value={String(uniqueTrackCount)} detail="уникальных треков" tone="green" />
        <StatCard icon={Library} label="Артисты" value={String(uniqueArtistCount)} detail="уникальных артистов" tone="purple" />
        <StatCard icon={Clock3} label="Длительность" value={formatDuration(totalDuration)} detail="суммарное время" tone="pink" />
      </section>

      <section>
        <SectionHeader title="Последние прослушивания" caption="Быстрый доступ к самым свежим трекам из истории." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {mostRecentTracks.map((track, index) => (
            <RecentTrackCard
              key={`${track.id}:${index}`}
              track={track}
              index={index}
              queueIds={mostRecentQueueIds}
              onPlay={props.onPlay}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <SectionHeader
            title="Timeline"
            caption="Сгруппировано по дням. Play, favorite, playlist и artist-open работают как раньше."
          />
          {props.sections.map((section, sectionIndex) => (
            <section key={section.dayKey} className="grid gap-4 md:grid-cols-[44px_1fr]">
              <TimelineMarker index={sectionIndex} />
              <div className="inspires-panel rounded-[26px] p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white/95">{formatHistoryDayLabel(section.dayKey)}</h3>
                    <p className="mt-1 text-xs text-white/40">{section.dayKey}</p>
                  </div>
                  <div className="rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/45">
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
              </div>
            </section>
          ))}
        </div>

        <aside className="space-y-4">
          <div className="inspires-panel rounded-[26px] p-4">
            <SectionHeader title="History insights" caption="Визуальные заготовки для будущих поведенческих сигналов." />
            <div className="space-y-3">
              <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.025] p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                  <TrendingUp size={16} />
                  Повторы
                </div>
                <p className="text-xs leading-5 text-white/43">Частые возвращения к трекам смогут усиливать affinity без добавления в избранное.</p>
              </div>
              <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.025] p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                  <Sparkles size={16} />
                  Новизна
                </div>
                <p className="text-xs leading-5 text-white/43">Недавно сыгранное не должно возвращаться как основная рекомендация.</p>
              </div>
              <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.025] p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                  <Radio size={16} />
                  Сессия
                </div>
                <p className="text-xs leading-5 text-white/43">Последние треки помогают мягко продолжать текущую волну прослушивания.</p>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
