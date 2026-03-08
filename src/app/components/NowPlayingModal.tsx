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
import { useEffect } from "react";
import { RepeatMode, Track } from "../types";
import { splitTrackArtists } from "../utils/artists";
import { formatDuration } from "../utils/format";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface NowPlayingModalProps {
  currentTrack: Track;
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
  onShowLyrics: () => void;
  onToggleFavorite: () => void;
  onAddToPlaylist: () => void;
  onOpenArtist: (artistName?: string) => void;
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

export function NowPlayingModal({
  currentTrack,
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
  onShowLyrics,
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/80 p-4 backdrop-blur-lg sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.12),transparent_40%),linear-gradient(180deg,#0b0d12,#080a10)] shadow-[0_32px_140px_rgba(0,0,0,0.62)]">
        <header className="flex items-center justify-between px-4 py-3 sm:px-6">
          <div className="text-xs uppercase tracking-[0.24em] text-cyan-200/65">Сейчас играет</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/65 transition hover:bg-white/10 hover:text-white"
            title="Закрыть"
          >
            <X size={22} />
          </button>
        </header>

        <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6 sm:pb-8">
          <div className="mx-auto flex min-h-full w-full max-w-[780px] flex-col items-center justify-center gap-3">
            <ImageWithFallback
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              className="aspect-square w-full max-w-[min(52vh,540px)] rounded-[28px] border border-white/10 object-cover shadow-[0_32px_90px_rgba(0,0,0,0.6)] lg:max-w-[min(56vh,600px)]"
            />

            <div className="w-full max-w-[700px] text-center">
              <h2 className="truncate text-xl font-semibold text-white sm:text-2xl">{currentTrack.title}</h2>
              {artistNames.length <= 1 ? (
                <button
                  type="button"
                  onClick={() => onOpenArtist(artistNames[0])}
                  className="mt-1 truncate text-cyan-200/80 transition hover:text-cyan-100"
                >
                  {currentTrack.artist}
                </button>
              ) : (
                <div className="mt-1 flex flex-wrap items-center justify-center gap-x-1 text-cyan-200/80">
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
              )}
            </div>

            <div className="w-full max-w-[700px] rounded-[28px] border border-white/10 bg-white/[0.03] p-3.5 shadow-[0_14px_42px_rgba(0,0,0,0.35)] sm:p-4">
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
                <button type="button" onClick={onShowLyrics} title="Детали трека" className={iconButtonClass()}>
                  <img src={subtitleIcon} alt="Детали трека" className="h-[19px] w-[19px]" />
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
          </div>
        </div>
      </div>
    </div>
  );
}
