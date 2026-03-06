import { Music4, Trash2 } from "lucide-react";
import { Playlist } from "../types";

interface PlaylistCardProps {
  playlist: Playlist;
  onOpen: () => void;
  onDelete: () => void;
}

function pluralizeTracks(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) {
    return "трек";
  }

  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return "трека";
  }

  return "треков";
}

export function PlaylistCard({ playlist, onOpen, onDelete }: PlaylistCardProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
          <Music4 size={22} />
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-full p-2 text-white/45 transition hover:bg-white/8 hover:text-rose-300"
        >
          <Trash2 size={18} />
        </button>
      </div>
      <button type="button" onClick={onOpen} className="text-left">
        <div className="text-lg font-semibold text-white">{playlist.name}</div>
        <div className="mt-1 text-sm text-white/50">
          {playlist.trackIds.length} {pluralizeTracks(playlist.trackIds.length)}
        </div>
      </button>
    </div>
  );
}
