import { ListPlus, Pause, Play, SkipBack, SkipForward } from "lucide-react";
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
import { RepeatMode, Track } from "../types";
import { formatDuration } from "../utils/format";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface PlayerBarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeatMode: RepeatMode;
  shuffleEnabled: boolean;
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
  return `rounded-full p-2 transition ${
    enabled
      ? "bg-cyan-300/16 text-cyan-100 hover:bg-cyan-300/22"
      : "text-white/65 hover:bg-white/10 hover:text-white"
  }`;
}

function getRangeTrackStyle(percent: number) {
  const safePercent = toBoundedNumber(percent, 0, 100);

  return {
    background: `linear-gradient(90deg, rgba(34, 211, 238, 0.95) 0%, rgba(34, 211, 238, 0.95) ${safePercent}%, rgba(255, 255, 255, 0.24) ${safePercent}%, rgba(255, 255, 255, 0.24) 100%)`,
  };
}

export function PlayerBar({
  currentTrack,
  isPlaying,
  progress,
  duration,
  volume,
  muted,
  repeatMode,
  shuffleEnabled,
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
}: PlayerBarProps) {
  const safeDuration = currentTrack ? Math.max(0, duration || currentTrack.duration) : 0;
  const boundedProgress = toBoundedNumber(progress, 0, safeDuration || 0);
  const progressMax = safeDuration > 0 ? safeDuration : 1;
  const volumeValue = toBoundedNumber(volume, 0, 1);
  const volumePercent = Math.round((muted ? 0 : volumeValue) * 100);
  const progressPercent = safeDuration > 0 ? (boundedProgress / safeDuration) * 100 : 0;
  const volumeTrackPercent = volumeValue * 100;
  const favorite = !!currentTrack?.isFavorite;

  return (
    <footer className="border-t border-white/6 px-5 py-3 sm:px-6">
      <div className="mx-auto w-full max-w-[1500px] rounded-[32px] border border-white/10 bg-[linear-gradient(130deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] px-5 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.42)] sm:px-6">
        {currentTrack ? (
          <div className="grid items-center gap-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)_220px]">
            <div className="flex min-w-0 items-center gap-4">
              <ImageWithFallback src={currentTrack.coverUrl} alt={currentTrack.title} className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
              <div className="min-w-0">
                <div className="truncate text-xl font-semibold text-white">{currentTrack.title}</div>
                <div className="mt-1 truncate text-sm text-white/55">{currentTrack.artist}</div>
                <div className="mt-2 inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/55">
                  {repeatLabelByMode[repeatMode]}
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleFavorite}
                  title={favorite ? "Удалить из избранного" : "Добавить в избранное"}
                  className={`group relative rounded-full p-2 transition ${
                    favorite ? "bg-rose-300/12 hover:bg-rose-300/20" : "text-white/65 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {favorite ? (
                    <>
                      <img src={favouriteIcon} alt="В избранном" className="h-[18px] w-[18px] transition-opacity duration-150 group-hover:opacity-0" />
                      <img src={heartbreakIcon} alt="Удалить из избранного" className="absolute left-1/2 top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                    </>
                  ) : (
                    <img src={favouriteIcon} alt="Добавить в избранное" className="h-[18px] w-[18px] opacity-80" />
                  )}
                </button>

                <button type="button" onClick={onAddToPlaylist} title="Добавить в плейлист" className={iconButtonClass()}>
                  <ListPlus size={18} />
                </button>
                <button type="button" onClick={onToggleShuffle} title="Перемешать" className={iconButtonClass(shuffleEnabled)}>
                  <img src={shuffleIcon} alt="Перемешать" className="h-[18px] w-[18px]" />
                </button>
                <button type="button" onClick={onPrevious} title="Предыдущий трек" className={iconButtonClass()}>
                  <SkipBack size={20} />
                </button>
                <button type="button" onClick={onPlayPause} title={isPlaying ? "Пауза" : "Воспроизвести"} className="rounded-full bg-white p-3 text-black transition hover:bg-white/90">
                  {isPlaying ? <Pause size={22} className="fill-black" /> : <Play size={22} className="fill-black" />}
                </button>
                <button type="button" onClick={onNext} title="Следующий трек" className={iconButtonClass()}>
                  <SkipForward size={20} />
                </button>
                <button type="button" onClick={onCycleRepeatMode} title={repeatLabelByMode[repeatMode]} className={iconButtonClass(repeatMode !== "off")}>
                  <img src={repeatIconByMode[repeatMode]} alt={repeatLabelByMode[repeatMode]} className="h-[18px] w-[18px]" />
                </button>
                <button type="button" onClick={onShowLyrics} title="Текст" className={iconButtonClass()}>
                  <img src={subtitleIcon} alt="Текст" className="h-[18px] w-[18px]" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-9 text-right text-sm text-white/45">{formatDuration(boundedProgress)}</span>
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
                <span className="w-9 text-sm text-white/45">{formatDuration(safeDuration)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-4">
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
                className="h-1.5 w-[170px] cursor-pointer appearance-none rounded-full accent-cyan-300"
              />
              <span className="w-10 text-right text-sm text-white/55">{volumePercent}%</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-5 text-sm text-white/45">
            Выберите трек, чтобы начать воспроизведение.
          </div>
        )}
      </div>
    </footer>
  );
}
