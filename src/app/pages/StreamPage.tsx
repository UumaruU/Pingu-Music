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
import { buildWaveQueueIds, resolveStreamWavePlaybackAction } from "./streamWavePlayback";

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

function areTrackIdsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((trackId, index) => trackId === right[index]);
}

// Frontend adapter: keeps the stream UX in true wave mode with only the next playable recommendation visible.
export function StreamPage(trackListProps: StreamPageProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [status, setStatus] = useState<StreamStatus>("loading");
  const [nextItem, setNextItem] = useState<FrontendRecommendedTrack | null>(null);
  const [seedLabel, setSeedLabel] = useState("Вашей волне");
  const [contextSummary, setContextSummary] = useState("Следующий трек подбирается по вашему вкусу.");
  const [strategy, setStrategy] = useState("user-feed");
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [wavePlaybackStarted, setWavePlaybackStarted] = useState(false);
  const requestIdRef = useRef(0);
  const currentQueue = useAppStore((state) => state.currentQueue);
  const queueCurrentTrackId = useAppStore((state) => state.currentTrackId);
  const syncQueue = useAppStore((state) => state.syncQueue);

  const currentBasisTrackId = queueCurrentTrackId ?? trackListProps.currentTrackId;
  const visibleTracks = useMemo(() => (nextItem ? [nextItem.track] : []), [nextItem]);
  const desiredWaveQueueIds = useMemo(
    () => buildWaveQueueIds(currentBasisTrackId, nextItem?.track.id ?? null),
    [currentBasisTrackId, nextItem],
  );

  async function loadWavePreview() {
    if (!isAuthenticated) {
      setNextItem(null);
      setSeedLabel("Требуется вход");
      setContextSummary("Войдите, чтобы сервер подбирал персональную волну.");
      setStrategy("user-feed");
      setStatus("idle");
      setError(null);
      return;
    }

    const nextRequestId = requestIdRef.current + 1;
    requestIdRef.current = nextRequestId;
    setStatus("loading");
    setError(null);
    setNextItem(null);

    try {
      const batch = await recommendationFacade.getRecommendationStreamBatch({
        limit: 1,
        mode: "autoplay",
        currentTrackId: currentBasisTrackId,
      });

      if (requestIdRef.current !== nextRequestId) {
        return;
      }

      setNextItem(batch.items[0] ?? null);
      setSeedLabel(batch.seedLabel);
      setContextSummary(
        batch.contextSummary ??
          (currentBasisTrackId
            ? "Следующий трек уже подготовлен после текущего."
            : "Волна готова запуститься с персонального следующего трека."),
      );
      setStrategy(batch.strategy ?? "user-feed");
      setStatus("ready");
    } catch (loadError) {
      if (requestIdRef.current !== nextRequestId) {
        return;
      }

      setStatus("error");
      setError(loadError instanceof Error ? loadError.message : "Не удалось собрать волну.");
    }
  }

  useEffect(() => {
    void loadWavePreview();
  }, [currentBasisTrackId, isAuthenticated, reloadToken]);

  useEffect(() => {
    if (!wavePlaybackStarted || !currentBasisTrackId || !desiredWaveQueueIds.length) {
      return;
    }

    if (areTrackIdsEqual(currentQueue, desiredWaveQueueIds)) {
      return;
    }

    syncQueue(desiredWaveQueueIds, desiredWaveQueueIds);
  }, [currentBasisTrackId, currentQueue, desiredWaveQueueIds, syncQueue, wavePlaybackStarted]);

  const handlePlayWave = () => {
    const action = resolveStreamWavePlaybackAction({
      currentTrackId: currentBasisTrackId,
      nextTrackId: nextItem?.track.id ?? null,
      isPlaying: trackListProps.isPlaying,
    });

    if (action.type === "unavailable") {
      return;
    }

    setWavePlaybackStarted(true);

    if (action.type === "sync-queue") {
      syncQueue(action.queueIds, action.queueIds);
      return;
    }

    trackListProps.onPlay(action.startTrackId, action.queueIds);
  };

  const handleRefreshWave = () => {
    setError(null);
    setReloadToken((value) => value + 1);
  };

  const handlePlayNextTrack = (trackId: string, queueIds: string[]) => {
    setWavePlaybackStarted(true);
    trackListProps.onPlay(trackId, queueIds.length ? queueIds : [trackId]);
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
              Персональная волна привязана к вашему аккаунту и живет на сервере.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
              После входа поток будет показывать только следующий трек и подготавливать новый шаг уже по мере прослушивания.
            </p>
          </div>
        </section>

        <EmptyState
          title="Войдите, чтобы открыть волну"
          description="Серверная система рекомендаций использует историю, избранное и поведение в приложении, поэтому для персональной волны нужен аккаунт."
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
            Волна
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-white">
            Бесконечный поток теперь показывает только один следующий трек.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
            Дальний хвост очереди больше не строится на фронтенде. Пока вы слушаете текущий трек, страница держит только следующий шаг волны, а после перехода запрашивает новый.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePlayWave}
              disabled={!nextItem}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-300/14 px-5 py-3 text-sm font-medium text-cyan-50 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Waves size={16} />
              {currentBasisTrackId ? "Подключить волну" : "Запустить волну"}
            </button>
            <button
              type="button"
              onClick={handleRefreshWave}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.08]"
            >
              <RefreshCw size={16} />
              Обновить
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-100">
              <Sparkles size={20} />
            </div>
            <div className="text-sm uppercase tracking-[0.22em] text-white/35">Профиль волны</div>
            <div className="mt-2 text-lg font-semibold text-white">Вкус, история и избранное</div>
            <div className="mt-2 text-sm text-white/55">
              Текущий трек не влияет на подбор волны. Он нужен только для playback и чтобы не повторить тот же трек.
            </div>
          </div>
          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
            <div className="text-sm uppercase tracking-[0.22em] text-white/35">Видимый next</div>
            <div className="mt-2 text-3xl font-semibold text-white">{nextItem ? 1 : 0}</div>
            <div className="mt-2 text-sm text-white/55">
              В интерфейсе хранится только один следующий трек, а не длинная локальная очередь.
            </div>
          </div>
          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
            <div className="text-sm uppercase tracking-[0.22em] text-white/35">Стратегия</div>
            <div className="mt-2 text-lg font-semibold text-white">{strategy}</div>
            <div className="mt-2 text-sm text-white/55">
              Волна остаётся бесконечной, но новые треки рождаются только по мере движения playback.
            </div>
          </div>
        </div>
      </section>

      {nextItem ? (
        <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
            {nextItem.sourceChannels[0] ?? "wave"}
          </div>
          <div className="text-lg font-semibold text-white">Следующий трек волны</div>
          <div className="mt-2 text-sm leading-6 text-white/65">
            {(nextItem.explanation.topReasons.slice(0, 3).join(" • ") || "user taste").replace(/channel:/g, "")}
          </div>
          {wavePlaybackStarted && currentBasisTrackId ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100/80">
              Уже стоит следующим после текущего трека
            </div>
          ) : null}
        </section>
      ) : null}

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Следующий трек</h2>
            <p className="mt-1 text-sm text-white/50">
              Здесь виден только один следующий шаг. После перехода на него волна запросит ещё один.
            </p>
          </div>
        </div>

        {status === "loading" ? (
          <EmptyState
            title="Подготавливаем следующий трек"
            description="Сервер подбирает только один следующий шаг волны, чтобы очередь не разрасталась заранее."
          />
        ) : null}

        {status === "error" ? (
          <EmptyState
            title="Не удалось построить волну"
            description={error ?? "Проверьте каталог и повторите попытку."}
            action={
              <button
                type="button"
                onClick={handleRefreshWave}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.08]"
              >
                <RefreshCw size={16} />
                Повторить
              </button>
            }
          />
        ) : null}

        {status === "ready" && visibleTracks.length ? (
          <TrackList
            tracks={visibleTracks}
            currentTrackId={trackListProps.currentTrackId}
            isPlaying={trackListProps.isPlaying}
            onPlay={handlePlayNextTrack}
            onToggleFavorite={trackListProps.onToggleFavorite}
            onAddToPlaylist={trackListProps.onAddToPlaylist}
            onShowLyrics={trackListProps.onShowLyrics}
            onOpenArtist={trackListProps.onOpenArtist}
          />
        ) : null}

        {status === "ready" && !visibleTracks.length ? (
          <EmptyState
            title="Следующий трек пока не найден"
            description="В текущем состоянии каталога и пользовательского профиля сервер не смог подобрать ещё один шаг волны."
          />
        ) : null}
      </section>
    </div>
  );
}
