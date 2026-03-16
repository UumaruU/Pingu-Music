import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Radio, RefreshCw, Sparkles, Waves } from "lucide-react";
import {
  FrontendRecommendedTrack,
  recommendationFacade,
} from "../integrations/recommendation/recommendationFacade";
import { EmptyState } from "../components/EmptyState";
import { TrackList } from "../components/TrackList";
import { useAppStore } from "../store/appStore";
import { useAuthStore } from "../store/authStore";

interface StreamPageProps {
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlay: (trackId: string, queueIds: string[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (trackId: string) => void;
  onShowLyrics: (trackId: string) => void;
  onOpenArtist: (trackId: string, artistName?: string) => void;
  onOpenLogin: () => void;
}

type StreamStatus = "idle" | "loading" | "ready" | "error";

// Frontend adapter: owns the infinite recommendation stream UX while the scoring/business logic stays in the domain module.
export function StreamPage(trackListProps: StreamPageProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [status, setStatus] = useState<StreamStatus>("loading");
  const [items, setItems] = useState<FrontendRecommendedTrack[]>([]);
  const [seedLabel, setSeedLabel] = useState("вашему вкусу");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [streamPlaybackStarted, setStreamPlaybackStarted] = useState(false);
  const requestIdRef = useRef(0);
  const observerTargetRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef<FrontendRecommendedTrack[]>([]);
  const currentQueue = useAppStore((state) => state.currentQueue);
  const queueCurrentTrackId = useAppStore((state) => state.currentTrackId);
  const syncQueue = useAppStore((state) => state.syncQueue);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const streamTracks = useMemo(() => items.map((item) => item.track), [items]);
  const streamQueueIds = useMemo(() => streamTracks.map((track) => track.id), [streamTracks]);

  async function loadBatch(reset: boolean) {
    if (!isAuthenticated) {
      setItems([]);
      setSeedLabel("требуется вход");
      setStatus("idle");
      setError(null);
      setHasMore(false);
      return;
    }

    const nextRequestId = requestIdRef.current + 1;
    requestIdRef.current = nextRequestId;

    if (reset) {
      setStatus("loading");
      setError(null);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    const knownItems = reset ? [] : itemsRef.current;

    try {
        const batch = await recommendationFacade.getRecommendationStreamBatch({
          limit: reset ? 14 : 10,
          mode: "autoplay",
          seedVariantTrackId: queueCurrentTrackId,
          excludeCanonicalTrackIds: knownItems.map((item) => item.canonicalTrackId),
          recentRecommendationIds: knownItems.map((item) => item.canonicalTrackId),
        });

      if (requestIdRef.current !== nextRequestId) {
        return;
      }

      const mergedItems = reset
        ? batch.items
        : [
            ...knownItems,
            ...batch.items.filter(
              (item) =>
                !knownItems.some(
                  (knownItem) => knownItem.canonicalTrackId === item.canonicalTrackId,
                ),
            ),
          ];

      setItems(mergedItems);
      setSeedLabel(batch.seedLabel);
      setStatus("ready");
      setHasMore(batch.items.length > 0);
    } catch (loadError) {
      if (requestIdRef.current !== nextRequestId) {
        return;
      }

      setStatus("error");
      setError(loadError instanceof Error ? loadError.message : "Не удалось собрать поток.");
    } finally {
      if (requestIdRef.current === nextRequestId) {
        setLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    void loadBatch(true);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!observerTargetRef.current || status !== "ready" || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || isLoadingMore) {
          return;
        }

        void loadBatch(false);
      },
      { rootMargin: "420px 0px" },
    );

    observer.observe(observerTargetRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoadingMore, status]);

  useEffect(() => {
    if (!streamPlaybackStarted || !queueCurrentTrackId || !streamQueueIds.length) {
      return;
    }

    if (!streamQueueIds.includes(queueCurrentTrackId)) {
      return;
    }

    const queueLooksLikeStream =
      currentQueue.length > 0 &&
      currentQueue.every((trackId) => streamQueueIds.includes(trackId));

    if (!queueLooksLikeStream || currentQueue.length >= streamQueueIds.length) {
      return;
    }

    syncQueue(streamQueueIds, streamQueueIds);
  }, [
    currentQueue,
    queueCurrentTrackId,
    syncQueue,
    streamPlaybackStarted,
    streamQueueIds,
  ]);

  useEffect(() => {
    if (!streamPlaybackStarted || !queueCurrentTrackId || !hasMore || isLoadingMore) {
      return;
    }

    const currentTrackIndex = streamQueueIds.indexOf(queueCurrentTrackId);

    if (currentTrackIndex < 0) {
      return;
    }

    const remainingTracks = streamQueueIds.length - currentTrackIndex - 1;
    if (remainingTracks <= 5) {
      void loadBatch(false);
    }
  }, [
    hasMore,
    isLoadingMore,
    queueCurrentTrackId,
    streamPlaybackStarted,
    streamQueueIds,
  ]);

  const handlePlayStream = (trackId: string, queueIds: string[]) => {
    setStreamPlaybackStarted(true);
    trackListProps.onPlay(trackId, queueIds);
  };

  if (!isAuthenticated) {
    return (
      <div className="space-y-8">
        <section className="grid gap-4 rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_32%),linear-gradient(135deg,#08101b,#0c1119_62%,#0f172a)] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.45)] lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-cyan-100/80">
              <Radio size={14} />
              Поток
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-white">
              Серверный поток рекомендаций привязан к аккаунту пользователя.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
              Чтобы получить персональный бесконечный поток, autoplay после конца очереди и сохранение recommendation-профиля в базе, нужно войти в аккаунт.
            </p>
          </div>
        </section>

        <EmptyState
          title="Войдите, чтобы открыть поток"
          description="Система рекомендаций больше не работает локально во фронтенде. Теперь она целиком исполняется на сервере и использует персональный профиль пользователя из базы данных."
          action={
            <button
              type="button"
              onClick={trackListProps.onOpenLogin}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-300/14 px-5 py-3 text-sm font-medium text-cyan-50 transition hover:bg-cyan-300/20"
            >
              Войти
              <ArrowRight size={16} />
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_32%),linear-gradient(135deg,#08101b,#0c1119_62%,#0f172a)] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.45)] lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-cyan-100/80">
            <Radio size={14} />
            Поток
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-white">
            Бесконечный рекомендательный поток поверх canonical graph и affinity-модели.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
            Страница собирает playable треки из recommendation engine, держит длинную очередь на фронтенде и автоматически догружает новые рекомендации, пока вы слушаете.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                if (!streamQueueIds.length) {
                  return;
                }

                handlePlayStream(streamQueueIds[0], streamQueueIds);
              }}
              disabled={!streamQueueIds.length}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-300/14 px-5 py-3 text-sm font-medium text-cyan-50 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Waves size={16} />
              Запустить поток
            </button>
            <button
              type="button"
              onClick={() => {
                setStreamPlaybackStarted(false);
                setItems([]);
                setSeedLabel("вашему вкусу");
                setError(null);
                void loadBatch(true);
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.08]"
            >
              <RefreshCw size={16} />
              Пересобрать поток
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-100">
              <Sparkles size={20} />
            </div>
            <div className="text-sm uppercase tracking-[0.22em] text-white/35">Текущий seed</div>
            <div className="mt-2 text-lg font-semibold text-white">{seedLabel}</div>
            <div className="mt-2 text-sm text-white/55">
              Поток продолжает текущий контекст, историю сессии и устойчивые affinity-сигналы.
            </div>
          </div>
          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
            <div className="text-sm uppercase tracking-[0.22em] text-white/35">Загружено</div>
            <div className="mt-2 text-3xl font-semibold text-white">{streamTracks.length}</div>
            <div className="mt-2 text-sm text-white/55">
              Очередь растёт по мере прослушивания и пополняется без остановки воспроизведения.
            </div>
          </div>
        </div>
      </section>

      {items.length ? (
        <section className="grid gap-3 lg:grid-cols-3">
          {items.slice(0, 3).map((item) => (
            <div
              key={`insight:${item.canonicalTrackId}`}
              className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.24)]"
            >
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
                {item.sourceChannels[0] ?? "hybrid"}
              </div>
              <div className="text-lg font-semibold text-white">{item.track.title}</div>
              <div className="mt-1 text-sm text-white/50">{item.track.artist}</div>
              <div className="mt-4 text-sm leading-6 text-white/65">
                {(item.explanation.topReasons.slice(0, 3).join(" • ") || "deterministic-match").replace(/channel:/g, "")}
              </div>
              <div className="mt-4 inline-flex items-center gap-2 text-sm text-cyan-100/80">
                Оценка {item.score.toFixed(2)}
                <ArrowRight size={14} />
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Рекомендованные треки</h2>
            <p className="mt-1 text-sm text-white/50">
              Playable очередь для радиопотока, autoplay и продолжения текущей сессии.
            </p>
          </div>
          {isLoadingMore ? (
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/55">
              Догружаем
            </div>
          ) : null}
        </div>

        {status === "loading" ? (
          <EmptyState
            title="Собираем поток"
            description="Движок подбирает стартовую очередь рекомендаций и готовит playable варианты."
          />
        ) : null}

        {status === "error" ? (
          <EmptyState
            title="Не удалось построить поток"
            description={error ?? "Проверьте каталог и повторите попытку."}
            action={
              <button
                type="button"
                onClick={() => {
                  setStreamPlaybackStarted(false);
                  setItems([]);
                  setSeedLabel("вашему вкусу");
                  setError(null);
                  void loadBatch(true);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.08]"
              >
                <RefreshCw size={16} />
                Повторить
              </button>
            }
          />
        ) : null}

        {status === "ready" && streamTracks.length ? (
          <>
            <TrackList
              tracks={streamTracks}
              currentTrackId={trackListProps.currentTrackId}
              isPlaying={trackListProps.isPlaying}
              onPlay={handlePlayStream}
              onToggleFavorite={trackListProps.onToggleFavorite}
              onAddToPlaylist={trackListProps.onAddToPlaylist}
              onShowLyrics={trackListProps.onShowLyrics}
              onOpenArtist={trackListProps.onOpenArtist}
            />
            <div ref={observerTargetRef} className="h-8 w-full" />
          </>
        ) : null}

        {status === "ready" && !streamTracks.length ? (
          <EmptyState
            title="Поток пока пуст"
            description="Поток уже использует избранное и историю автоматически. Если здесь пусто, значит в текущем каталоге пока недостаточно связанных playable рекомендаций."
          />
        ) : null}
      </section>
    </div>
  );
}
