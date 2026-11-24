import { useMemo, useState } from "react";
import { AlertCircle, ArrowRight, Compass, Layers3, Loader2, Music2, Play, Radio, Search, Sparkles } from "lucide-react";
import { CanonicalTrackList } from "../components/CanonicalTrackList";
import { EmptyState } from "../components/EmptyState";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { TrackList } from "../components/TrackList";
import { CanonicalTrack, SearchStatus, Track } from "../types";
import { formatDuration } from "../utils/format";

interface SearchPageProps {
  tracks: Track[];
  tracksById: Record<string, Track>;
  canonicalTracks: CanonicalTrack[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlay: (trackId: string, queueIds: string[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (trackId: string) => void;
  onShowLyrics: (trackId: string) => void;
  onOpenArtist: (trackId: string, artistName?: string) => void;
  query: string;
  status: SearchStatus;
  error: string | null;
  recentQueries: string[];
  onSelectRecentQuery: (query: string) => void;
}

type SearchFilter = "all" | "canonical" | "tracks" | "sources";

const popularQueries = ["synthwave", "indie pop", "night drive", "lo-fi", "hyperpop", "dark r&b"];

function resolveDisplayTrack(canonicalTrack: CanonicalTrack, tracksById: Record<string, Track>) {
  const preferredTrackId = canonicalTrack.preferredVariantId ?? canonicalTrack.variantTrackIds[0];
  const variant = preferredTrackId ? tracksById[preferredTrackId] : null;

  if (!variant) {
    return null;
  }

  return {
    ...variant,
    title: canonicalTrack.title || variant.title,
    artist: canonicalTrack.artist || variant.artist,
    albumTitle: canonicalTrack.album ?? variant.albumTitle,
    coverUrl: canonicalTrack.coverUrl || variant.coverUrl,
    duration: canonicalTrack.targetDuration ?? variant.duration,
  } satisfies Track;
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

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inspires-focus-ring rounded-full border px-4 py-2 text-sm transition ${
        active
          ? "border-white bg-white text-black"
          : "border-white/[0.07] bg-white/[0.035] text-white/68 hover:bg-white/[0.07] hover:text-white"
      }`}
    >
      {label}
      {typeof count === "number" ? <span className="ml-2 opacity-60">{count}</span> : null}
    </button>
  );
}

function SearchResultCard({
  track,
  queueIds,
  onPlay,
  onToggleFavorite,
}: {
  track: Track;
  queueIds: string[];
  onPlay: (trackId: string, queueIds: string[]) => void;
  onToggleFavorite: (trackId: string) => void;
}) {
  return (
    <article className="inspires-lift group rounded-[24px] border border-white/[0.06] bg-white/[0.026] p-3">
      <button
        type="button"
        onClick={() => onPlay(track.id, queueIds)}
        className="inspires-focus-ring relative block w-full overflow-hidden rounded-[20px]"
      >
        <ImageWithFallback src={track.coverUrl} alt={track.title} className="aspect-square w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/38 opacity-0 transition group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black">
            <Play size={17} className="fill-black" />
          </span>
        </span>
      </button>
      <div className="mt-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{track.title}</div>
          <div className="mt-1 truncate text-xs text-white/43">{track.artist}</div>
          <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-white/32">{formatDuration(track.duration)}</div>
        </div>
        <button
          type="button"
          onClick={() => onToggleFavorite(track.id)}
          className={`inspires-focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
            track.isFavorite
              ? "border-rose-300/25 bg-rose-300/14 text-rose-100"
              : "border-white/[0.07] bg-white/[0.035] text-white/62 hover:bg-white/[0.07] hover:text-white"
          }`}
          title={track.isFavorite ? "Убрать из избранного" : "Добавить в избранное"}
        >
          <Sparkles size={15} />
        </button>
      </div>
    </article>
  );
}

function StatusPanel({
  status,
  query,
  error,
}: {
  status: SearchStatus;
  query: string;
  error: string | null;
}) {
  if (status === "loading") {
    return (
      <div className="inspires-panel flex items-center gap-3 rounded-[24px] p-5 text-sm text-white/58">
        <Loader2 size={18} className="animate-spin text-white" />
        Ищем треки и обновляем карточки метаданных...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-[24px] border border-rose-300/20 bg-rose-300/8 p-5 text-sm text-rose-100/85">
        <div className="mb-2 flex items-center gap-2 font-medium text-rose-50">
          <AlertCircle size={18} />
          Не удалось выполнить поиск
        </div>
        {error ?? "Попробуйте выполнить поиск позже."}
      </div>
    );
  }

  if (status === "empty") {
    return (
      <EmptyState
        title="Ничего не найдено"
        description={`По запросу «${query}» результатов нет. Попробуйте другой запрос или имя исполнителя.`}
      />
    );
  }

  return null;
}

export function SearchPage({
  query,
  status,
  error,
  recentQueries,
  onSelectRecentQuery,
  tracks,
  tracksById,
  canonicalTracks,
  ...trackListProps
}: SearchPageProps) {
  const [activeFilter, setActiveFilter] = useState<SearchFilter>("all");
  const cleanQuery = query.trim();
  const hasQuery = cleanQuery.length > 0;
  const canonicalDisplayTracks = useMemo(
    () =>
      canonicalTracks
        .map((canonicalTrack) => resolveDisplayTrack(canonicalTrack, tracksById))
        .filter((track): track is Track => !!track),
    [canonicalTracks, tracksById],
  );
  const featuredTracks = (canonicalDisplayTracks.length ? canonicalDisplayTracks : tracks).slice(0, 6);
  const featuredQueueIds = featuredTracks.map((track) => track.id);
  const hasCanonicalResults = hasQuery && canonicalTracks.length > 0;
  const shouldShowCanonical =
    hasCanonicalResults && (activeFilter === "all" || activeFilter === "canonical" || activeFilter === "sources");
  const shouldShowTracks =
    tracks.length > 0 && (activeFilter === "all" || activeFilter === "tracks");
  const resultLabel = hasQuery ? `Результаты по запросу «${cleanQuery}»` : "Популярное сейчас";
  const sourceCount = new Set(tracks.map((track) => track.providerId)).size;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="relative overflow-hidden rounded-[30px] border border-white/[0.07] bg-[radial-gradient(circle_at_16%_8%,rgba(20,216,255,0.25),transparent_28%),radial-gradient(circle_at_90%_0%,rgba(181,60,255,0.24),transparent_32%),linear-gradient(135deg,rgba(16,17,20,0.94),rgba(5,5,5,0.96))] p-6 shadow-[var(--im-shadow)] sm:p-7">
          <div className="absolute -right-16 bottom-[-90px] h-64 w-64 rotate-[-12deg] rounded-[58px] border border-white/[0.08] bg-black/24" />
          <div className="relative z-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.11] bg-white/[0.05] px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-white/64">
              <Search size={14} />
              search lab
            </div>
            <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.01em] text-white sm:text-5xl">
              Найди трек, артиста или настроение
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/58">
              Верхняя строка поиска остаётся основным вводом. Пустой запрос показывает популярные треки, а найденные варианты группируются в canonical-кластеры, если они доступны.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {(recentQueries.length ? recentQueries.slice(0, 5) : popularQueries).map((recentQuery) => (
                <button
                  key={recentQuery}
                  type="button"
                  onClick={() => onSelectRecentQuery(recentQuery)}
                  className="inspires-focus-ring rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm text-white/68 transition hover:bg-white/[0.08] hover:text-white"
                >
                  {recentQuery}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="inspires-panel rounded-[26px] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[17px] bg-white text-black">
                <Compass size={19} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Режим выдачи</div>
                <div className="mt-1 text-xs text-white/43">{hasQuery ? "Поиск по внешним источникам" : "Популярные треки"}</div>
              </div>
            </div>
            <div className="mt-5 rounded-[18px] border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/34">Найдено</div>
              <div className="mt-2 text-3xl font-semibold text-white">{hasCanonicalResults ? canonicalTracks.length : tracks.length}</div>
            </div>
          </div>

          <div className="inspires-panel rounded-[26px] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[17px] bg-[var(--im-green)] text-black">
                <Layers3 size={19} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Source mapping</div>
                <div className="mt-1 text-xs text-white/43">Варианты остаются playable-источниками</div>
              </div>
            </div>
            <div className="mt-5 rounded-[18px] border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/34">Источников</div>
              <div className="mt-2 text-3xl font-semibold text-white">{sourceCount}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="inspires-panel rounded-[26px] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip label="Все" count={tracks.length + canonicalTracks.length} active={activeFilter === "all"} onClick={() => setActiveFilter("all")} />
          <FilterChip label="Канон" count={canonicalTracks.length} active={activeFilter === "canonical"} onClick={() => setActiveFilter("canonical")} />
          <FilterChip label="Треки" count={tracks.length} active={activeFilter === "tracks"} onClick={() => setActiveFilter("tracks")} />
          <FilterChip label="Источники" count={sourceCount} active={activeFilter === "sources"} onClick={() => setActiveFilter("sources")} />
        </div>
      </section>

      <StatusPanel status={status} query={cleanQuery} error={error} />

      {featuredTracks.length && status !== "loading" && status !== "error" ? (
        <section>
          <SectionHeader
            title={resultLabel}
            caption={hasQuery ? "Быстрые карточки первых результатов. Полный список ниже." : "Популярные треки появляются здесь до ввода запроса."}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {featuredTracks.map((track) => (
              <SearchResultCard
                key={track.id}
                track={track}
                queueIds={featuredQueueIds}
                onPlay={trackListProps.onPlay}
                onToggleFavorite={trackListProps.onToggleFavorite}
              />
            ))}
          </div>
        </section>
      ) : null}

      {shouldShowCanonical ? (
        <section>
          <SectionHeader
            title="Canonical results"
            caption="Группировка вариантов одного трека, если canonicalization уже построила кластеры."
          />
          <CanonicalTrackList
            canonicalTracks={canonicalTracks}
            tracksById={tracksById}
            {...trackListProps}
          />
        </section>
      ) : null}

      {shouldShowTracks && !shouldShowCanonical ? (
        <section>
          <SectionHeader
            title={hasQuery ? "Треки" : "Популярные треки"}
            caption="Живой список результатов с текущими действиями плеера."
          />
          <TrackList tracks={tracks} {...trackListProps} />
        </section>
      ) : null}

      {shouldShowTracks && shouldShowCanonical && activeFilter === "all" ? (
        <section>
          <SectionHeader title="Все playable-варианты" caption="Оригинальный список источников сохранён для совместимости." />
          <TrackList tracks={tracks} {...trackListProps} />
        </section>
      ) : null}

      {!cleanQuery && status === "idle" && !tracks.length ? (
        <EmptyState
          title="Начните искать музыку"
          description="Введите запрос в верхнюю строку, чтобы увидеть результаты и популярные треки."
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="inspires-lift rounded-[24px] border border-white/[0.06] bg-white/[0.026] p-4">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[17px] bg-white text-black">
            <Music2 size={18} />
          </div>
          <div className="text-sm font-semibold text-white">Tracks</div>
          <div className="mt-1 text-xs leading-5 text-white/43">Реальный поиск остаётся подключён к текущему `musicService`.</div>
        </div>
        <div className="inspires-lift rounded-[24px] border border-white/[0.06] bg-white/[0.026] p-4">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[17px] bg-[var(--im-purple)] text-black">
            <Layers3 size={18} />
          </div>
          <div className="text-sm font-semibold text-white">Canonical</div>
          <div className="mt-1 text-xs leading-5 text-white/43">Если есть варианты одного трека, они раскрываются как версии.</div>
        </div>
        <div className="inspires-lift rounded-[24px] border border-white/[0.06] bg-white/[0.026] p-4">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[17px] bg-[var(--im-green)] text-black">
            <Radio size={18} />
          </div>
          <div className="text-sm font-semibold text-white">Discovery-safe</div>
          <div className="mt-1 text-xs leading-5 text-white/43">Страница поиска не делает discovery сама, а только показывает результаты backend/frontend поиска.</div>
        </div>
      </section>
    </div>
  );
}
