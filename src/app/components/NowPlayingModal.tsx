import { ListPlus, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import favouriteIcon from "@/assets/icons/favourite-stroke-rounded.svg";
import heartbreakIcon from "@/assets/icons/heartbreak-stroke-rounded.svg";
import repeatIcon from "@/assets/icons/repeat-stroke-rounded.svg";
import repeatOffIcon from "@/assets/icons/repeat-off-stroke-rounded.svg";
import repeatOneIcon from "@/assets/icons/repeat-one-01-stroke-rounded.svg";
import shuffleIcon from "@/assets/icons/shuffle-stroke-rounded.svg";
import subtitleIcon from "@/assets/icons/subtitle-stroke-rounded.svg";
import volumeHighIcon from "@/assets/icons/volume-high-stroke-rounded.svg";
import volumeLowIcon from "@/assets/icons/volume-low-stroke-rounded.svg";
import volumeMuteIcon from "@/assets/icons/volume-mute-02-stroke-rounded.svg";
import { useEffect, useMemo, useRef, useState } from "react";
import { Artist, Lyrics, Release, RepeatMode, Track } from "../types";
import { splitTrackArtists } from "../utils/artists";
import { formatDuration } from "../utils/format";
import { ImageWithFallback } from "./figma/ImageWithFallback";

type NowPlayingViewMode = "cover" | "details";

interface NowPlayingModalProps {
  currentTrack: Track;
  artist?: Artist;
  release?: Release;
  lyrics?: Lyrics;
  viewMode: NowPlayingViewMode;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeatMode: RepeatMode;
  shuffleEnabled: boolean;
  onClose: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (value: number) => void;
  onVolumeChange: (value: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeatMode: () => void;
  onChangeViewMode: (viewMode: NowPlayingViewMode) => void;
  onSeekToLyrics: (seconds: number) => void;
  onToggleFavorite: () => void;
  onAddToPlaylist: () => void;
  onOpenArtist: (artistName?: string) => void;
}

interface SyncedLyricLine {
  id: string;
  time: number;
  text: string;
}

const repeatIconByMode: Record<RepeatMode, string> = {
  off: repeatOffIcon,
  one: repeatOneIcon,
  all: repeatIcon,
};

const repeatLabelByMode: Record<RepeatMode, string> = {
  off: "Без повтора",
  one: "Повтор трека",
  all: "Повтор очереди",
};

function getVolumeIcon(volume: number, muted: boolean) {
  if (muted || volume <= 0) {
    return volumeMuteIcon;
  }

  if (volume < 0.3) {
    return volumeLowIcon;
  }

  return volumeHighIcon;
}

function toBoundedNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function iconButtonClass(enabled?: boolean) {
  return `rounded-full p-2.5 transition ${
    enabled
      ? "bg-cyan-300/16 text-cyan-100 hover:bg-cyan-300/22"
      : "text-white/70 hover:bg-white/10 hover:text-white"
  }`;
}

function getRangeTrackStyle(percent: number) {
  const safePercent = toBoundedNumber(percent, 0, 100);

  return {
    background: `linear-gradient(90deg, rgba(34, 211, 238, 0.95) 0%, rgba(34, 211, 238, 0.95) ${safePercent}%, rgba(255, 255, 255, 0.24) ${safePercent}%, rgba(255, 255, 255, 0.24) 100%)`,
  };
}

function parseSyncedLyrics(syncedText: string | undefined) {
  if (!syncedText?.trim()) {
    return [] as SyncedLyricLine[];
  }

  const lines: SyncedLyricLine[] = [];
  const timestampPattern = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  syncedText.split(/\r?\n/).forEach((rawLine, lineIndex) => {
    const matches = Array.from(rawLine.matchAll(timestampPattern));

    if (!matches.length) {
      return;
    }

    const text = rawLine.replace(timestampPattern, "").trim();

    if (!text) {
      return;
    }

    matches.forEach((match, matchIndex) => {
      const minutes = Number.parseInt(match[1], 10);
      const seconds = Number.parseInt(match[2], 10);
      const fractionRaw = match[3] ?? "";
      const fractionLength = fractionRaw.length;
      const fraction = fractionLength
        ? Number.parseInt(fractionRaw, 10) / 10 ** fractionLength
        : 0;
      const time = minutes * 60 + seconds + fraction;

      if (!Number.isFinite(time)) {
        return;
      }

      lines.push({
        id: `${lineIndex}:${matchIndex}:${time.toFixed(3)}`,
        time,
        text,
      });
    });
  });

  return lines.sort((left, right) => left.time - right.time);
}

function getActiveSyncedLineIndex(lines: SyncedLyricLine[], progress: number) {
  if (!lines.length || !Number.isFinite(progress)) {
    return -1;
  }

  let activeIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (progress + 0.05 >= lines[index].time) {
      activeIndex = index;
    } else {
      break;
    }
  }

  return activeIndex;
}

function formatLyricsTimestamp(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function NowPlayingModal({
  currentTrack,
  artist,
  release,
  lyrics,
  viewMode,
  isPlaying,
  progress,
  duration,
  volume,
  muted,
  repeatMode,
  shuffleEnabled,
  onClose,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeatMode,
  onChangeViewMode,
  onSeekToLyrics,
  onToggleFavorite,
  onAddToPlaylist,
  onOpenArtist,
}: NowPlayingModalProps) {
  const safeDuration = Math.max(0, duration || currentTrack.duration);
  const boundedProgress = toBoundedNumber(progress, 0, safeDuration || 0);
  const progressMax = safeDuration > 0 ? safeDuration : 1;
  const volumeValue = toBoundedNumber(volume, 0, 1);
  const volumePercent = Math.round((muted ? 0 : volumeValue) * 100);
  const progressPercent = safeDuration > 0 ? (boundedProgress / safeDuration) * 100 : 0;
  const volumeTrackPercent = volumeValue * 100;
  const favorite = !!currentTrack.isFavorite;
  const artistNames = splitTrackArtists(currentTrack.artist);
  const syncedLines = useMemo(() => parseSyncedLyrics(lyrics?.synced), [lyrics?.synced]);
  const activeLineIndex = useMemo(
    () => getActiveSyncedLineIndex(syncedLines, boundedProgress),
    [boundedProgress, syncedLines],
  );
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const lyricsLineRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [isManualLyricsScroll, setIsManualLyricsScroll] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setIsManualLyricsScroll(false);
  }, [currentTrack.id, viewMode]);

  useEffect(() => {
    if (viewMode !== "details" || isManualLyricsScroll || activeLineIndex < 0 || !syncedLines.length) {
      return;
    }

    const activeLine = syncedLines[activeLineIndex];
    const container = lyricsContainerRef.current;
    const activeElement = activeLine ? lyricsLineRefs.current[activeLine.id] : null;

    if (!container || !activeElement) {
      return;
    }

    const centeredTop =
      activeElement.offsetTop - container.clientHeight / 2 + activeElement.clientHeight / 2;

    container.scrollTo({
      top: Math.max(0, centeredTop),
      behavior: "smooth",
    });
  }, [activeLineIndex, isManualLyricsScroll, syncedLines, viewMode]);

  const switchToManualMode = () => {
    if (!syncedLines.length || isManualLyricsScroll) {
      return;
    }
    setIsManualLyricsScroll(true);
  };

  const renderArtists = (prefix: string, buttonClass: string) => {
    if (artistNames.length <= 1) {
      return (
        <button
          type="button"
          onClick={() => onOpenArtist(artistNames[0])}
          className={buttonClass}
        >
          {artist?.name || currentTrack.artist}
        </button>
      );
    }

    return (
      <div className={`${prefix} flex flex-wrap items-center gap-x-1 text-cyan-200/80`}>
        {artistNames.map((artistName, index) => (
          <div key={`${currentTrack.id}:np:${artistName}`} className="contents">
            <button
              type="button"
              onClick={() => onOpenArtist(artistName)}
              className="transition hover:text-cyan-100"
            >
              {artistName}
            </button>
            {index < artistNames.length - 1 ? <span className="text-white/35">,</span> : null}
          </div>
        ))}
      </div>
    );
  };

  const renderPlaybackControls = (wide: boolean) => (
    <div
      className={`rounded-[28px] border border-white/10 bg-white/[0.03] p-3.5 shadow-[0_14px_42px_rgba(0,0,0,0.35)] ${
        wide ? "w-full" : "w-full max-w-[700px]"
      } sm:p-4`}
    >
      <div className="flex items-center gap-3">
        <span className="w-10 text-right text-sm text-white/50">{formatDuration(boundedProgress)}</span>
        <input
          type="range"
          min={0}
          max={progressMax}
          step={0.1}
          value={boundedProgress}
          onChange={(event) => onSeek(Number(event.target.value))}
          style={getRangeTrackStyle(progressPercent)}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-cyan-300"
        />
        <span className="w-10 text-sm text-white/50">{formatDuration(safeDuration)}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={onToggleFavorite}
          title={favorite ? "Убрать из избранного" : "Добавить в избранное"}
          className={`group relative rounded-full p-2.5 transition ${
            favorite ? "bg-rose-300/12 hover:bg-rose-300/20" : "hover:bg-white/10"
          }`}
        >
          {favorite ? (
            <>
              <img
                src={favouriteIcon}
                alt="В избранном"
                className="h-[19px] w-[19px] transition-opacity duration-150 group-hover:opacity-0"
              />
              <img
                src={heartbreakIcon}
                alt="Убрать из избранного"
                className="absolute left-1/2 top-1/2 h-[19px] w-[19px] -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              />
            </>
          ) : (
            <img src={favouriteIcon} alt="Добавить в избранное" className="h-[19px] w-[19px] opacity-80" />
          )}
        </button>
        <button type="button" onClick={onAddToPlaylist} title="Добавить в плейлист" className={iconButtonClass()}>
          <ListPlus size={18} />
        </button>
        <button type="button" onClick={onToggleShuffle} title="Перемешать" className={iconButtonClass(shuffleEnabled)}>
          <img src={shuffleIcon} alt="Перемешать" className="h-[19px] w-[19px]" />
        </button>
        <button type="button" onClick={onPrevious} title="Предыдущий трек" className={iconButtonClass()}>
          <SkipBack size={21} />
        </button>
        <button
          type="button"
          onClick={onPlayPause}
          title={isPlaying ? "Пауза" : "Воспроизвести"}
          className="rounded-full bg-white p-3.5 text-black transition hover:bg-white/90"
        >
          {isPlaying ? <Pause size={24} className="fill-black" /> : <Play size={24} className="fill-black" />}
        </button>
        <button type="button" onClick={onNext} title="Следующий трек" className={iconButtonClass()}>
          <SkipForward size={21} />
        </button>
        <button type="button" onClick={onCycleRepeatMode} title={repeatLabelByMode[repeatMode]} className={iconButtonClass(repeatMode !== "off")}>
          <img src={repeatIconByMode[repeatMode]} alt={repeatLabelByMode[repeatMode]} className="h-[19px] w-[19px]" />
        </button>
        <button
          type="button"
          onClick={() => onChangeViewMode(viewMode === "cover" ? "details" : "cover")}
          title={viewMode === "cover" ? "Показать данные и текст" : "Вернуться к обложке"}
          className={iconButtonClass(viewMode === "details")}
        >
          <img src={subtitleIcon} alt="Режим данных трека" className="h-[19px] w-[19px]" />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button type="button" onClick={onToggleMute} title={muted ? "Включить звук" : "Выключить звук"} className={iconButtonClass()}>
          <img src={getVolumeIcon(volumeValue, muted)} alt="Громкость" className="h-5 w-5" />
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volumeValue}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
          style={getRangeTrackStyle(volumeTrackPercent)}
          className="h-1.5 w-[220px] max-w-[42vw] cursor-pointer appearance-none rounded-full accent-cyan-300"
        />
        <span className="w-10 text-right text-sm text-white/55">{volumePercent}%</span>
      </div>
    </div>
  );

  const renderLyricsPanel = () => {
    if (!lyrics || lyrics.status === "loading") {
      return <div className="py-10 text-center text-white/45">Загрузка текста...</div>;
    }

    if (lyrics.status === "failed") {
      return (
        <div className="py-10 text-center text-white/45">
          {lyrics.error || "Не удалось загрузить текст"}
        </div>
      );
    }

    if (lyrics.status === "missing" || (!lyrics.plain && !syncedLines.length)) {
      return <div className="py-10 text-center text-white/45">Текст не найден</div>;
    }

    if (syncedLines.length) {
      return (
        <div className="flex h-full min-h-0 flex-col">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs text-white/42">
              {isManualLyricsScroll
                ? "Ручной режим: прокрутите и нажмите строку для перемотки."
                : "Автопрокрутка по активной строке."}
            </p>
            <button
              type="button"
              onClick={() => setIsManualLyricsScroll((prev) => !prev)}
              className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 transition hover:border-cyan-300/45 hover:text-cyan-100"
            >
              {isManualLyricsScroll ? "Авторежим" : "Ручной режим"}
            </button>
          </div>
          <div
            ref={lyricsContainerRef}
            onWheel={switchToManualMode}
            className="scrollbar-none relative min-h-0 flex-1 overflow-y-auto"
          >
            <div className="pointer-events-none sticky top-0 z-[1] h-14 bg-gradient-to-b from-[#0f1219] to-transparent" />
            <div className="space-y-2 px-1 pb-12">
              {syncedLines.map((line, index) => {
                const isActiveLine = activeLineIndex === index;
                const distanceFromActive =
                  activeLineIndex < 0 ? 99 : Math.abs(index - activeLineIndex);
                const fadedOpacity = isActiveLine
                  ? 1
                  : distanceFromActive <= 1
                    ? 0.54
                    : distanceFromActive <= 2
                      ? 0.34
                      : 0.18;

                return (
                  <button
                    key={line.id}
                    type="button"
                    ref={(element) => {
                      lyricsLineRefs.current[line.id] = element;
                    }}
                    onClick={() => onSeekToLyrics(line.time)}
                    className={`flex w-full rounded-2xl px-3 text-left transition ${
                      isManualLyricsScroll
                        ? "items-start gap-3 py-2.5 text-white/80 hover:bg-white/[0.06] hover:text-white"
                        : "justify-center py-4"
                    }`}
                    style={isManualLyricsScroll ? undefined : { opacity: fadedOpacity }}
                  >
                    {isManualLyricsScroll ? (
                      <span className="w-12 shrink-0 pt-0.5 text-xs text-white/40">
                        {formatLyricsTimestamp(line.time)}
                      </span>
                    ) : null}
                    <span
                      className={`${
                        isManualLyricsScroll
                          ? "text-[1.15rem] font-medium leading-7"
                          : "text-center text-[clamp(1.55rem,2.7vw,2.8rem)] font-semibold leading-[1.14]"
                      } ${isActiveLine ? "text-white" : "text-white/85"} transition`}
                    >
                      {line.text}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="pointer-events-none sticky bottom-0 z-[1] h-14 bg-gradient-to-t from-[#0f1219] to-transparent" />
          </div>
        </div>
      );
    }

    return (
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto whitespace-pre-line pr-1 text-base leading-8 text-white/80">
        {lyrics.plain}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/80 p-4 backdrop-blur-lg sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.12),transparent_40%),linear-gradient(180deg,#0b0d12,#080a10)] shadow-[0_32px_140px_rgba(0,0,0,0.62)]">
        <header className="flex items-center justify-between px-4 py-3 sm:px-6">
          <div className="text-xs uppercase tracking-[0.24em] text-cyan-200/65">Сейчас играет</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChangeViewMode(viewMode === "cover" ? "details" : "cover")}
              className="rounded-full border border-white/12 px-3 py-1 text-xs text-white/70 transition hover:border-cyan-300/45 hover:text-cyan-100"
            >
              {viewMode === "cover" ? "Данные" : "Обложка"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-white/65 transition hover:bg-white/10 hover:text-white"
              title="Закрыть"
            >
              <X size={22} />
            </button>
          </div>
        </header>

        <div
          className={`min-h-0 flex-1 px-4 pb-6 sm:px-6 sm:pb-8 ${
            viewMode === "details" ? "overflow-hidden" : "scrollbar-none overflow-y-auto"
          }`}
        >
          <div
            className={`mx-auto flex w-full max-w-[1420px] flex-col gap-4 ${
              viewMode === "details" ? "h-full justify-between" : "min-h-full justify-center"
            }`}
          >
            {viewMode === "details" ? (
              <div className="grid min-h-0 flex-1 items-stretch gap-4 overflow-hidden xl:grid-cols-[minmax(260px,1fr)_minmax(420px,0.95fr)_minmax(320px,1fr)]">
                <section className="overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                  <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-200/60">Метаданные</div>
                  <dl className="grid gap-3">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                      <dt className="text-xs uppercase tracking-[0.24em] text-white/40">Трек</dt>
                      <dd className="mt-2 text-base text-white">{currentTrack.title}</dd>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                      <dt className="text-xs uppercase tracking-[0.24em] text-white/40">Исполнитель</dt>
                      <dd className="mt-2 text-base text-white">{artist?.name || currentTrack.artist}</dd>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                      <dt className="text-xs uppercase tracking-[0.24em] text-white/40">Альбом</dt>
                      <dd className="mt-2 text-base text-white">
                        {release?.title || currentTrack.albumTitle || "Неизвестно"}
                      </dd>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                        <dt className="text-xs uppercase tracking-[0.24em] text-white/40">Длительность</dt>
                        <dd className="mt-2 text-base text-white">{formatDuration(currentTrack.duration)}</dd>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                        <dt className="text-xs uppercase tracking-[0.24em] text-white/40">Дата релиза</dt>
                        <dd className="mt-2 text-base text-white">
                          {release?.date || currentTrack.releaseDate || "Неизвестно"}
                        </dd>
                      </div>
                    </div>
                  </dl>
                </section>

                <section className="flex min-h-0 flex-col items-center justify-center gap-3">
                  <ImageWithFallback
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    className="aspect-square w-full max-w-[min(45vh,520px)] rounded-[28px] border border-white/10 object-cover shadow-[0_28px_82px_rgba(0,0,0,0.58)]"
                  />
                  <div className="w-full max-w-[620px] text-center">
                    <h2 className="truncate text-2xl font-semibold text-white">{currentTrack.title}</h2>
                    {renderArtists("mt-1 justify-center", "mt-1 text-cyan-200/80 transition hover:text-cyan-100")}
                  </div>
                </section>

                <section className="flex min-h-0 flex-col overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                  <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-200/60">Текст песни</div>
                  {renderLyricsPanel()}
                </section>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-[780px] flex-col items-center justify-center gap-3">
                <ImageWithFallback
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  className="aspect-square w-full max-w-[min(52vh,540px)] rounded-[28px] border border-white/10 object-cover shadow-[0_32px_90px_rgba(0,0,0,0.6)] lg:max-w-[min(56vh,600px)]"
                />
                <div className="w-full max-w-[700px] text-center">
                  <h2 className="truncate text-xl font-semibold text-white sm:text-2xl">{currentTrack.title}</h2>
                  {renderArtists("mt-1 justify-center", "mt-1 truncate text-cyan-200/80 transition hover:text-cyan-100")}
                </div>
              </div>
            )}

            <div className="mx-auto w-full max-w-[980px] shrink-0">{renderPlaybackControls(true)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
