import { ListPlus, Pause, Play, Trash2 } from "lucide-react";
import downloadIcon from "@/assets/icons/download-circle-01-stroke-rounded.svg";
import favouriteIcon from "@/assets/icons/favourite-stroke-rounded.svg";
import heartbreakIcon from "@/assets/icons/heartbreak-stroke-rounded.svg";
import subtitleIcon from "@/assets/icons/subtitle-stroke-rounded.svg";
import { Track } from "../types";
import { formatDuration } from "../utils/format";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface TrackRowProps {
  index: number;
  track: Track;
  isActive: boolean;
  isPlaying: boolean;
  onToggleFavorite: () => void;
  onPlay: () => void;
  onAddToPlaylist: () => void;
  onShowLyrics: () => void;
  onRemoveFromPlaylist?: () => void;
}

const downloadStateLabel: Record<Track["downloadState"], string> = {
  idle: "Не скачан",
  downloading: "Скачивание...",
  downloaded: "Скачано",
  error: "Ошибка загрузки",
};

const downloadStateClasses: Record<Track["downloadState"], string> = {
  idle: "bg-white/8 text-white/55",
  downloading: "bg-cyan-300/16 text-cyan-100",
  downloaded: "bg-emerald-300/16 text-emerald-100",
  error: "bg-rose-300/16 text-rose-100",
};

export function TrackRow({
  index,
  track,
  isActive,
  isPlaying,
  onToggleFavorite,
  onPlay,
  onAddToPlaylist,
  onShowLyrics,
  onRemoveFromPlaylist,
}: TrackRowProps) {
  return (
    <article
      className={`group rounded-xl px-3 py-1.5 transition-colors ${
        isActive ? "bg-cyan-300/[0.12]" : "bg-transparent hover:bg-white/[0.06]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-7 text-center text-sm text-white/30">{index}</div>
        <button type="button" className="relative cursor-pointer" onClick={onPlay}>
          <ImageWithFallback src={track.coverUrl} alt={track.title} className="h-14 w-14 rounded-2xl object-cover" />
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 opacity-0 transition group-hover:opacity-100">
            {isPlaying ? <Pause size={20} className="fill-white text-white" /> : <Play size={20} className="fill-white text-white" />}
          </div>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-base font-medium text-white">{track.title}</div>
            {track.isFavorite ? (
              <span
                title="В избранном"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-300/30 bg-rose-300/12"
              >
                <img src={favouriteIcon} alt="В избранном" className="h-4 w-4" />
              </span>
            ) : null}
            {track.downloadState !== "idle" ? (
              <span
                title={downloadStateLabel[track.downloadState]}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${downloadStateClasses[track.downloadState]}`}
              >
                <img
                  src={track.downloadState === "error" ? heartbreakIcon : downloadIcon}
                  alt={downloadStateLabel[track.downloadState]}
                  className={`h-4 w-4 ${track.downloadState === "downloading" ? "animate-pulse" : ""}`}
                />
              </span>
            ) : null}
          </div>
          <div className="mt-1 truncate text-sm text-white/50">{track.artist}</div>
          {track.downloadError ? <div className="mt-2 text-xs text-rose-200/80">{track.downloadError}</div> : null}
        </div>

        <div className="hidden min-w-[46px] text-right text-sm text-white/45 md:block">{formatDuration(track.duration)}</div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={onShowLyrics} className="rounded-full p-2 text-white/45 transition hover:bg-white/8 hover:text-white" title="Текст">
            <img src={subtitleIcon} alt="Текст" className="h-[18px] w-[18px] opacity-80" />
          </button>
          <button type="button" onClick={onAddToPlaylist} className="rounded-full p-2 text-white/45 transition hover:bg-white/8 hover:text-white" title="Добавить в плейлист">
            <ListPlus size={18} />
          </button>
          {onRemoveFromPlaylist ? (
            <button type="button" onClick={onRemoveFromPlaylist} className="rounded-full p-2 text-white/45 transition hover:bg-white/8 hover:text-rose-200" title="Убрать из плейлиста">
              <Trash2 size={18} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleFavorite}
            className={`rounded-full p-2 transition ${
              track.isFavorite ? "group relative bg-rose-300/12 hover:bg-rose-300/18" : "hover:bg-white/8"
            }`}
            title={track.isFavorite ? "Удалить из избранного" : "Добавить в избранное"}
          >
            {track.isFavorite ? (
              <>
                <img src={favouriteIcon} alt="Избранное" className="h-[18px] w-[18px] transition-opacity duration-150 group-hover:opacity-0" />
                <img src={heartbreakIcon} alt="Удалить из избранного" className="absolute left-1/2 top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
              </>
            ) : (
              <img src={heartbreakIcon} alt="Добавить в избранное" className="h-[18px] w-[18px] opacity-70" />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
