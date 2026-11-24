import { useEffect, useRef, useState } from "react";
import {
  Clock3,
  Library,
  Play,
  SlidersHorizontal,
} from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { TrackList } from "../components/TrackList";
import {
  FrontendRecommendedTrack,
  recommendationFacade,
} from "../integrations/recommendation/recommendationFacade";
import { useAppStore } from "../store/appStore";
import { useAuthStore } from "../store/authStore";
import { Track } from "../types";
import { formatDuration } from "../utils/format";

interface HomePageProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlay: (trackId: string, queueIds: string[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (trackId: string) => void;
  onShowLyrics: (trackId: string) => void;
  onOpenArtist: (trackId: string, artistName?: string) => void;
  onOpenLogin: () => void;
}

type WaveStatus = "idle" | "loading" | "ready" | "error";

const fallbackArtists = [
  { name: "Luna Ray", meta: "2.4M слушателей" },
  { name: "Violet Noise", meta: "984K слушателей" },
  { name: "Neon Kid", meta: "756K слушателей" },
  { name: "Artemis", meta: "421K слушателей" },
  { name: "Skyline", meta: "318K слушателей" },
];

const fallbackReleases = [
  { title: "Midnight Bloom", artist: "Luna Ray", kind: "EP", artworkClass: "inspires-artwork-pink" },
  { title: "Static Hearts", artist: "Violet Noise", kind: "Album", artworkClass: "" },
  { title: "Amber City", artist: "Neon Kid", kind: "Single", artworkClass: "inspires-artwork-amber" },
  { title: "Velvet Air", artist: "Artemis", kind: "Single", artworkClass: "inspires-artwork-green" },
];

const genres = ["Synthwave", "Indie Pop", "Hyperpop", "Lo-fi", "Alt Rock", "Dark R&B", "House", "Chillout"];

function getArtistNamesFromTracks(tracks: Track[]) {
  const counts = new Map<string, number>();

  tracks.forEach((track) => {
    const firstArtist = track.artist.split(/[,/&]/)[0]?.trim();
    if (!firstArtist) {
      return;
    }

    counts.set(firstArtist, (counts.get(firstArtist) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, meta: `${count} трек${count === 1 ? "" : "ов"} в каталоге` }));
}

function SectionHeader({
  title,
  caption,
}: {
  title: string;
  caption?: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {caption ? <p className="mt-1 text-sm text-white/45">{caption}</p> : null}
    </div>
  );
}

function ArtistBubble({ name, meta, index }: { name: string; meta: string; index: number }) {
  const colors = ["bg-[var(--im-purple)]", "bg-[var(--im-green)]", "bg-[var(--im-pink)]", "bg-[var(--im-cyan)]", "bg-white"];

  return (
    <div className="inspires-lift rounded-[20px] border border-white/[0.06] bg-white/[0.026] p-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${colors[index % colors.length]} text-sm font-semibold text-black`}>
          {name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">{name}</div>
          <div className="mt-1 truncate text-xs text-white/40">{meta}</div>
        </div>
      </div>
    </div>
  );
}

function ReleaseCard({
  title,
  artist,
  kind,
  artworkClass,
}: {
  title: string;
  artist: string;
  kind: string;
  artworkClass: string;
}) {
  return (
    <div className="inspires-lift rounded-[20px] border border-white/[0.06] bg-white/[0.026] p-3">
      <div className={`inspires-artwork ${artworkClass} aspect-square rounded-[18px]`} />
      <div className="mt-3 min-w-0">
        <div className="truncate text-sm font-medium text-white">{title}</div>
        <div className="mt-1 truncate text-xs text-white/40">
          {artist} · {kind}
        </div>
      </div>
    </div>
  );
}

function QueueRow({
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
      className="inspires-focus-ring inspires-lift flex w-full items-center gap-3 rounded-[18px] border border-white/[0.05] bg-white/[0.022] p-2 text-left"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-white/[0.055] text-xs text-white/48">
        {String(index + 1).padStart(2, "0")}
      </span>
      <ImageWithFallback src={track.coverUrl} alt={track.title} className="h-11 w-11 shrink-0 rounded-[14px] object-cover" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-white">{track.title}</span>
        <span className="mt-0.5 block truncate text-xs text-white/40">{track.artist}</span>
      </span>
      <span className="text-xs text-white/36">{formatDuration(track.duration)}</span>
    </button>
  );
}

function InlineNextRecommendation({
  nextItem,
  status,
  error,
  isAuthenticated,
  contextSummary,
}: {
  nextItem: FrontendRecommendedTrack | null;
  status: WaveStatus;
  error: string | null;
  isAuthenticated: boolean;
  contextSummary: string | null;
}) {
  if (status === "loading") {
    return (
      <div className="min-w-[260px] flex-1 rounded-[24px] border border-white/[0.1] bg-black/24 p-4 text-sm text-white/62 backdrop-blur">
        Готовим следующий трек рекомендаций...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-w-[260px] flex-1 rounded-[24px] border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-50/82 backdrop-blur">
        <div>{error ?? "Не удалось собрать следующий трек."}</div>
      </div>
    );
  }

  if (!nextItem) {
    return (
      <div className="min-w-[260px] flex-1 rounded-[24px] border border-white/[0.1] bg-black/24 p-4 text-sm text-white/62 backdrop-blur">
        {isAuthenticated
          ? contextSummary ?? "Сервер пока не нашел следующий playable трек для этой волны рекомендаций."
          : "Следующий трек появится после входа или загрузки каталога."}
      </div>
    );
  }

  return (
    <div className="flex min-w-[280px] flex-1 items-center gap-4 rounded-[24px] border border-white/[0.11] bg-black/24 p-3 shadow-[0_18px_54px_rgba(0,0,0,0.28)] backdrop-blur">
      <ImageWithFallback src={nextItem.track.coverUrl} alt={nextItem.track.title} className="h-14 w-14 shrink-0 rounded-[16px] object-cover" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/42">Следующий трек</div>
        <div className="mt-1 truncate text-base font-semibold text-white">{nextItem.track.title}</div>
        <div className="mt-1 truncate text-sm text-white/50">{nextItem.track.artist}</div>
      </div>
      <div className="hidden text-sm font-semibold text-white/45 sm:block">
        {formatDuration(nextItem.track.duration)}
      </div>
    </div>
  );
}

function RecommendationSettingsDraft() {
  return (
    <div className="inspires-panel rounded-[26px] p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[17px] bg-white text-black">
          <SlidersHorizontal size={19} />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Настройки рекомендаций</div>
          <div className="mt-1 text-xs text-white/43">Заготовка под управление потоком</div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-white/48">
            <span>Новизна</span>
            <span>65%</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.08]">
            <div className="h-full w-[65%] rounded-full bg-[var(--im-cyan)]" />
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-white/48">
            <span>Похожесть</span>
            <span>Баланс</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.08]">
            <div className="h-full w-1/2 rounded-full bg-[var(--im-green)]" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {["Без повторов", "Больше любимого", "Мягкий старт"].map((label) => (
            <button
              key={label}
              type="button"
              className="inspires-focus-ring rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs font-semibold text-white/58 transition hover:bg-white/[0.07] hover:text-white"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HomePage(props: HomePageProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const queueCurrentTrackId = useAppStore((state) => state.currentTrackId);
  const [status, setStatus] = useState<WaveStatus>("loading");
  const [nextItem, setNextItem] = useState<FrontendRecommendedTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [recommendationRequestId, setRecommendationRequestId] = useState<string | null>(null);
  const [contextSummary, setContextSummary] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const impressionKeysRef = useRef(new Set<string>());
  const queueTracks = props.tracks.slice(0, 4);
  const queueIds = queueTracks.map((track) => track.id);
  const artistItems = getArtistNamesFromTracks(props.tracks);
  const visibleArtists = artistItems.length ? artistItems : fallbackArtists;
  const currentBasisTrackId = queueCurrentTrackId ?? props.currentTrackId;

  useEffect(() => {
    if (!isAuthenticated) {
      setNextItem(null);
      setRecommendationRequestId(null);
      setContextSummary(null);
      setStatus("idle");
      setError(null);
      return;
    }

    let cancelled = false;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus("loading");
    setError(null);
    setNextItem(null);
    setRecommendationRequestId(null);
    setContextSummary(null);

    void recommendationFacade
      .getRecommendationStreamBatch({
        limit: 1,
        mode: "autoplay",
        currentTrackId: currentBasisTrackId,
      })
      .then((batch) => {
        if (cancelled || requestIdRef.current !== requestId) {
          return;
        }

        setNextItem(batch.items[0] ?? null);
        setRecommendationRequestId(batch.requestId ?? null);
        setContextSummary(batch.contextSummary ?? null);
        setStatus("ready");
      })
      .catch((loadError) => {
        if (cancelled || requestIdRef.current !== requestId) {
          return;
        }

        setStatus("error");
        setError(loadError instanceof Error ? loadError.message : "Не удалось собрать следующий трек.");
      });

    return () => {
      cancelled = true;
    };
  }, [currentBasisTrackId, isAuthenticated, reloadToken]);

  useEffect(() => {
    if (status !== "ready" || !recommendationRequestId || !nextItem) {
      return;
    }

    const key = `${recommendationRequestId}:home:${nextItem.track.id}:0`;
    if (impressionKeysRef.current.has(key)) {
      return;
    }

    impressionKeysRef.current.add(key);
    void recommendationFacade.recordRecommendationImpressions([
      {
        requestId: recommendationRequestId,
        surface: "home",
        position: 0,
        trackId: nextItem.track.id,
      },
    ]);
  }, [nextItem, recommendationRequestId, status]);

  const handleRefreshWave = () => {
    setError(null);
    setReloadToken((value) => value + 1);
  };

  const handlePlayWave = () => {
    if (!isAuthenticated) {
      props.onOpenLogin();
      return;
    }

    if (!nextItem) {
      handleRefreshWave();
      return;
    }

    if (recommendationRequestId) {
      void recommendationFacade.recordRecommendationInteraction({
        requestId: recommendationRequestId,
        surface: "home",
        position: 0,
        trackId: nextItem.track.id,
        action: "play",
        metadata: { trigger: "home_listen_button" },
      });
    }

    props.onPlay(nextItem.track.id, [nextItem.track.id]);
  };

  const handlePlayNextTrack = (trackId: string, nextQueueIds: string[]) => {
    if (recommendationRequestId && nextItem?.track.id === trackId) {
      void recommendationFacade.recordRecommendationInteraction({
        requestId: recommendationRequestId,
        surface: "home",
        position: 0,
        trackId,
        action: "play",
      });
    }
    props.onPlay(trackId, nextQueueIds.length ? nextQueueIds : [trackId]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.01em] text-white sm:text-4xl">Главная</h1>
        <p className="mt-2 text-sm text-white/45">Персональная точка входа в музыку, подборки и discovery-поток.</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
        <div className="relative min-h-[320px] overflow-hidden rounded-[30px] border border-white/[0.07] bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.22),transparent_18%),radial-gradient(circle_at_78%_10%,rgba(20,216,255,0.26),transparent_28%),linear-gradient(135deg,rgba(181,60,255,0.72),rgba(11,11,13,0.92)_58%,rgba(55,212,107,0.34))] p-6 shadow-[var(--im-shadow)] sm:p-8">
          <div className="absolute -right-16 bottom-[-95px] h-72 w-72 rotate-[-12deg] rounded-[60px] border border-white/[0.08] bg-black/24" />
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-3xl font-semibold leading-tight tracking-[-0.01em] text-white sm:text-5xl">
              Рекомендации, собранные под твой вкус
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/66">
              Свежие релизы, похожие исполнители и треки, которые хорошо зайдут после последних прослушиваний.
            </p>
            <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-stretch">
              <button
                type="button"
                onClick={handlePlayWave}
                disabled={isAuthenticated && status === "loading"}
                className="inspires-focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-wait disabled:opacity-70"
              >
                <Play size={16} className="fill-black" />
                Слушать
              </button>
              <InlineNextRecommendation
                nextItem={nextItem}
                status={status}
                error={error}
                isAuthenticated={isAuthenticated}
                contextSummary={contextSummary}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <RecommendationSettingsDraft />
        </div>
      </section>

      {nextItem ? (
        <section className="inspires-panel rounded-[26px] p-4">
          <SectionHeader
            title="Следующий трек в рекомендациях"
            caption="Это тот самый next для потока на главной."
          />
          <TrackList
            tracks={[nextItem.track]}
            currentTrackId={props.currentTrackId}
            isPlaying={props.isPlaying}
            onPlay={handlePlayNextTrack}
            onToggleFavorite={props.onToggleFavorite}
            onAddToPlaylist={props.onAddToPlaylist}
            onShowLyrics={props.onShowLyrics}
            onOpenArtist={props.onOpenArtist}
          />
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_390px]">
        <div>
          <SectionHeader title="Популярные артисты" caption="Блок использует локальный каталог, если он уже загружен." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleArtists.map((artist, index) => (
              <ArtistBubble key={artist.name} name={artist.name} meta={artist.meta} index={index} />
            ))}
          </div>
        </div>

        <div className="inspires-panel rounded-[26px] p-4">
          <SectionHeader title="Дальше в очереди" caption="Быстрый старт из текущего каталога." />
          {queueTracks.length ? (
            <div className="space-y-2">
              {queueTracks.map((track, index) => (
                <QueueRow key={track.id} track={track} index={index} queueIds={queueIds} onPlay={props.onPlay} />
              ))}
            </div>
          ) : (
            <div className="rounded-[20px] border border-dashed border-white/[0.08] bg-white/[0.02] p-5 text-sm text-white/43">
              Очередь появится после загрузки каталога или поиска треков.
            </div>
          )}
        </div>
      </section>

      <section>
        <SectionHeader title="Новые релизы" caption="Заглушка под будущие релизы из discovery index." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {fallbackReleases.map((release) => (
            <ReleaseCard key={`${release.artist}:${release.title}`} {...release} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Жанры и быстрые категории" caption="Безопасные визуальные фильтры, без новых API-вызовов." />
        <div className="flex flex-wrap gap-2">
          {genres.map((genre) => (
            <button
              key={genre}
              type="button"
              className="inspires-focus-ring rounded-full border border-white/[0.07] bg-white/[0.035] px-4 py-2 text-sm text-white/68 transition hover:bg-white/[0.07] hover:text-white"
            >
              {genre}
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Популярные треки"
          caption="Список оставлен живым: play, favorite, playlist и artist-open работают как раньше."
        />
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
            title="Каталог пока пуст"
            description="Когда появятся треки из поиска или синхронизации, они отобразятся в этом блоке."
          />
        )}
      </section>

      <div className="flex items-center gap-2 rounded-[22px] border border-white/[0.06] bg-white/[0.025] p-4 text-sm text-white/45">
        <Clock3 size={16} />
        <span>Следующие этапы дизайна: поиск, история, профиль и настройки.</span>
        <Library size={16} className="ml-auto hidden text-white/30 sm:block" />
      </div>
    </div>
  );
}
