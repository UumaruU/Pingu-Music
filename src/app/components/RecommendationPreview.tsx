import { useEffect, useState } from "react";
import { ArrowRight, Radio, RefreshCw, Sparkles } from "lucide-react";
import {
  FrontendRecommendedTrack,
  recommendationFacade,
} from "../integrations/recommendation/recommendationFacade";
import { EmptyState } from "./EmptyState";
import { TrackList } from "./TrackList";
import { useAuthStore } from "../store/authStore";

interface RecommendationPreviewProps {
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

type PreviewStatus = "idle" | "loading" | "ready" | "error";

// Frontend adapter: renders a lightweight recommendation preview without coupling the domain to UI state.
export function RecommendationPreview({
  onOpenStream,
  onOpenLogin,
  ...trackListProps
}: RecommendationPreviewProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [status, setStatus] = useState<PreviewStatus>("loading");
  const [seedLabel, setSeedLabel] = useState("вашему вкусу");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<FrontendRecommendedTrack[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      setSeedLabel("требуется вход");
      setStatus("idle");
      setError(null);
      return;
    }

    let cancelled = false;

    async function loadRecommendations() {
      setStatus("loading");
      setError(null);

      try {
        const batch = await recommendationFacade.getRecommendationStreamBatch({
          limit: 5,
          mode: "autoplay",
        });

        if (cancelled) {
          return;
        }

        setItems(batch.items);
        setSeedLabel(batch.seedLabel);
        setStatus("ready");
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setStatus("error");
        setError(loadError instanceof Error ? loadError.message : "Не удалось собрать рекомендации.");
      }
    }

    void loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, reloadToken, trackListProps.currentTrackId]);

  const previewTracks = items.map((item) => item.track);

  return (
    <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,12,19,0.95),rgba(17,24,39,0.86))] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-cyan-100/80">
            <Radio size={14} />
            Поток рекомендаций
          </div>
          <h2 className="text-2xl font-semibold text-white">Рекомендации уже готовы и доступны прямо в плеере.</h2>
          <p className="mt-3 text-sm leading-7 text-white/60">
            Блок строится поверх гибридного recommendation engine и подбирает playable треки из канонического графа, истории, избранного и текущей сессии.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onOpenStream}
            className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-300/14 px-5 py-3 text-sm font-medium text-cyan-50 transition hover:bg-cyan-300/20"
          >
            Открыть поток
            <ArrowRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.08]"
          >
            <RefreshCw size={16} />
            Обновить
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/12 text-cyan-100">
            <Sparkles size={18} />
          </div>
          <div className="text-sm uppercase tracking-[0.2em] text-white/40">Основа</div>
          <div className="mt-2 text-lg font-semibold text-white">{seedLabel}</div>
          <div className="mt-2 text-sm text-white/55">Текущий seed для потока и autoplay.</div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm uppercase tracking-[0.2em] text-white/40">В очереди</div>
          <div className="mt-2 text-3xl font-semibold text-white">{previewTracks.length}</div>
          <div className="mt-2 text-sm text-white/55">Стартовый набор рекомендаций для непрерывного воспроизведения.</div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm uppercase tracking-[0.2em] text-white/40">Режим</div>
          <div className="mt-2 text-lg font-semibold text-white">Hybrid graph stream</div>
          <div className="mt-2 text-sm text-white/55">Контент, связи артистов, affinity и мягкая популярность.</div>
        </div>
      </div>

      {!isAuthenticated ? (
        <EmptyState
          title="Рекомендации доступны только после входа"
          description="Поток, autoplay и персональные подборки теперь полностью считаются на сервере и привязаны к аккаунту пользователя."
          action={
            <button
              type="button"
              onClick={onOpenLogin}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-300/14 px-5 py-3 text-sm font-medium text-cyan-50 transition hover:bg-cyan-300/20"
            >
              Войти
              <ArrowRight size={16} />
            </button>
          }
        />
      ) : null}

      {isAuthenticated && status === "loading" ? (
        <EmptyState
          title="Собираем рекомендации"
          description="Движок строит стартовую подборку для потока из текущего каталога и вашего контекста."
        />
      ) : null}

      {isAuthenticated && status === "error" ? (
        <EmptyState
          title="Не удалось загрузить рекомендации"
          description={error ?? "Попробуйте открыть поток ещё раз после обновления каталога."}
          action={
            <button
              type="button"
              onClick={() => setReloadToken((value) => value + 1)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.08]"
            >
              <RefreshCw size={16} />
              Повторить
            </button>
          }
        />
      ) : null}

      {isAuthenticated && status === "ready" && previewTracks.length ? (
        <TrackList tracks={previewTracks} {...trackListProps} />
      ) : null}

      {isAuthenticated && status === "ready" && !previewTracks.length ? (
        <EmptyState
          title="Рекомендаций пока нет"
          description="Система уже учитывает ваши избранные треки и историю. Если подборка всё ещё пустая, значит в текущем каталоге пока мало связанных playable треков."
          action={
            <button
              type="button"
              onClick={onOpenStream}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-300/14 px-5 py-3 text-sm font-medium text-cyan-50 transition hover:bg-cyan-300/20"
            >
              Открыть поток
              <ArrowRight size={16} />
            </button>
          }
        />
      ) : null}
    </section>
  );
}
