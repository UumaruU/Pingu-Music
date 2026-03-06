import { X } from "lucide-react";
import { Track } from "../types";

interface LyricsModalProps {
  track: Track;
  onClose: () => void;
}

export function LyricsModal({ track, onClose }: LyricsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-[30px] border border-white/10 bg-[#181818] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <div>
            <h2 className="text-xl font-semibold text-white">{track.title}</h2>
            <p className="mt-1 text-sm text-white/60">{track.artist}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="max-h-[calc(80vh-100px)] overflow-y-auto p-6">
          {track.lyrics ? (
            <div className="whitespace-pre-line text-center leading-relaxed text-white/80">{track.lyrics}</div>
          ) : (
            <div className="py-12 text-center text-white/40">Текст песни недоступен</div>
          )}
        </div>
      </div>
    </div>
  );
}
