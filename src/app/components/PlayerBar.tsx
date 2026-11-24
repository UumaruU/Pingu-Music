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
import { splitTrackArtists } from "../utils/artists";
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
  onOpenArtist: (artistName?: string) => void;
  onOpenNowPlaying: () => void;
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

function getRangeTrackStyle(percent: number) {
  const safePercent = toBoundedNumber(percent, 0, 100);

  return {
    background: `linear-gradient(90deg, var(--im-purple) 0%, #fff ${safePercent}%, rgba(255, 255, 255, 0.18) ${safePercent}%, rgba(255, 255, 255, 0.18) 100%)`,
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
  onOpenArtist,
  onOpenNowPlaying,
}: PlayerBarProps) {
  const safeDuration = currentTrack ? Math.max(0, duration || currentTrack.duration) : 0;
  const boundedProgress = toBoundedNumber(progress, 0, safeDuration || 0);
  const progressMax = safeDuration > 0 ? safeDuration : 1;
  const volumeValue = toBoundedNumber(volume, 0, 1);
  const progressPercent = safeDuration > 0 ? (boundedProgress / safeDuration) * 100 : 0;
  const volumeTrackPercent = volumeValue * 100;
  const artistNames = currentTrack ? splitTrackArtists(currentTrack.artist) : [];

  return (
    <footer className="min-h-[82px] rounded-[28px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-[14px_18px] shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
      {currentTrack ? (
        <div className="grid items-center gap-[16px] xl:grid-cols-[260px_1fr_220px]">
          <div className="flex min-w-0 items-center gap-[14px]">
            <button
              type="button"
              onClick={onOpenNowPlaying}
              title="Открыть полноэкранный плеер"
              className="shrink-0 rounded-[18px] transition hover:opacity-90"
            >
              <ImageWithFallback
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className="h-[52px] w-[52px] rounded-[18px] border border-white/[0.04] object-cover"
              />
            </button>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold text-white">{currentTrack.title}</div>
              {artistNames.length <= 1 ? (
                <button
                  type="button"
                  onClick={() => onOpenArtist(artistNames[0])}
                  className="mt-1 truncate text-left text-[13px] text-white/52 transition hover:text-white"
                >
                  {currentTrack.artist}
                </button>
              ) : (
                <div className="mt-1 flex flex-wrap items-center gap-x-1 text-[13px] text-white/52">
                  {artistNames.map((artistName, index) => (
                    <div key={`${currentTrack.id}:${artistName}`} className="contents">
                      <button
                        type="button"
                        onClick={() => onOpenArtist(artistName)}
                        className="truncate text-left transition hover:text-white"
                      >
                        {artistName}
                      </button>
                      {index < artistNames.length - 1 ? <span className="text-white/35">,</span> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col items-center justify-center gap-[10px]">
            <div className="flex items-center gap-[14px] text-[#ddd]">
              <button
                type="button"
                onClick={onCycleRepeatMode}
                title={repeatLabelByMode[repeatMode]}
                className="flex h-[28px] w-[28px] items-center justify-center rounded-full border border-white/[0.05] bg-white/[0.04] text-white transition hover:translate-y-[-1px]"
              >
                <img
                  src={repeatIconByMode[repeatMode]}
                  alt={repeatLabelByMode[repeatMode]}
                  className="h-[12px] w-[12px]"
                />
              </button>
              <button
                type="button"
                onClick={onPrevious}
                title="Предыдущий трек"
                className="flex h-[28px] w-[28px] items-center justify-center rounded-full border border-white/[0.05] bg-white/[0.04] text-white transition hover:translate-y-[-1px]"
              >
                <SkipBack size={12} />
              </button>
              <button
                type="button"
                onClick={onPlayPause}
                title={isPlaying ? "Пауза" : "Воспроизвести"}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white text-black shadow-[0_6px_16px_rgba(255,255,255,0.12)] transition hover:bg-white/90"
              >
                {isPlaying ? (
                  <Pause size={14} className="fill-black" />
                ) : (
                  <Play size={14} className="ml-[2px] fill-black" />
                )}
              </button>
              <button
                type="button"
                onClick={onNext}
                title="Следующий трек"
                className="flex h-[28px] w-[28px] items-center justify-center rounded-full border border-white/[0.05] bg-white/[0.04] text-white transition hover:translate-y-[-1px]"
              >
                <SkipForward size={12} />
              </button>
              <button
                type="button"
                onClick={onToggleShuffle}
                title="Перемешать"
                className="flex h-[28px] w-[28px] items-center justify-center rounded-full border border-white/[0.05] bg-white/[0.04] text-white transition hover:translate-y-[-1px]"
              >
                <img src={shuffleIcon} alt="Перемешать" className="h-[12px] w-[12px]" />
              </button>
            </div>

            <div className="flex w-full min-w-0 max-w-[520px] items-center gap-[12px] text-[12px] text-[var(--im-muted)]">
              <span>{formatDuration(boundedProgress)}</span>
              <div className="relative h-[6px] flex-1 cursor-pointer rounded-full bg-white/[0.18]">
                <input
                  type="range"
                  min={0}
                  max={progressMax}
                  step={0.1}
                  value={boundedProgress}
                  onChange={(event) => onSeek(Number(event.target.value))}
                  className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
                />
                <div
                  className="pointer-events-none absolute left-0 top-0 h-full rounded-full bg-[linear-gradient(90deg,var(--im-purple),#fff)]"
                  style={{ width: `${progressPercent}%` }}
                />
                <div
                  className="pointer-events-none absolute top-1/2 h-[10px] w-[10px] -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.08)]"
                  style={{ left: `${progressPercent}%`, transform: `translate(-50%, -50%)` }}
                />
              </div>
              <span>{formatDuration(safeDuration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-[10px] text-[13px] text-[var(--im-muted)]">
            <span>Очередь</span>
            <button type="button" onClick={onToggleMute} title={muted ? "Включить звук" : "Выключить звук"}>
              <img src={getVolumeIcon(volumeValue, muted)} alt="Громкость" className="h-[18px] w-[18px]" />
            </button>
            <div className="relative h-[4px] w-[86px] cursor-pointer rounded-full bg-white/[0.15]">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volumeValue}
                onChange={(event) => onVolumeChange(Number(event.target.value))}
                className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
              />
              <div
                className="pointer-events-none absolute left-0 top-0 h-full rounded-full bg-white/[0.8]"
                style={{ width: `${volumeTrackPercent}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-[18px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-5 text-[14px] text-white/45">
          Выберите трек, чтобы начать воспроизведение.
        </div>
      )}
    </footer>
  );
}
