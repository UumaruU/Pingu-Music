import { Plus, X } from "lucide-react";
import { Playlist, Track } from "../types";

interface AddToPlaylistModalProps {
  track: Track | null;
  playlists: Playlist[];
  onClose: () => void;
  onAddToPlaylist: (playlistId: string) => void;
  onCreatePlaylist: (name: string) => void;
}

export function AddToPlaylistModal({
  track,
  playlists,
  onClose,
  onAddToPlaylist,
  onCreatePlaylist,
}: AddToPlaylistModalProps) {
  if (!track) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[30px] border border-white/10 bg-[#11141b] p-6 shadow-[0_24px_100px_rgba(0,0,0,0.55)]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-white">Добавить в плейлист</div>
            <div className="mt-1 text-sm text-white/50">
              {track.title} · {track.artist}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-white/55 hover:bg-white/8 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="mb-5 grid gap-3">
          {playlists.length ? (
            playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                onClick={() => onAddToPlaylist(playlist.id)}
                className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left text-white transition hover:border-cyan-300/30 hover:bg-cyan-300/8"
              >
                <span>
                  <span className="block font-medium">{playlist.name}</span>
                  <span className="block text-xs text-white/45">{playlist.trackIds.length} треков</span>
                </span>
                <Plus size={18} className="text-cyan-200" />
              </button>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/45">
              Плейлистов пока нет. Создайте первый ниже.
            </div>
          )}
        </div>

        <form
          className="flex gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const value = `${formData.get("playlist-name") ?? ""}`.trim();
            if (!value) {
              return;
            }
            onCreatePlaylist(value);
            event.currentTarget.reset();
          }}
        >
          <input
            name="playlist-name"
            placeholder="Новый плейлист"
            className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-cyan-300/40"
          />
          <button
            type="submit"
            className="rounded-2xl bg-cyan-300 px-4 py-3 font-medium text-slate-950 transition hover:bg-cyan-200"
          >
            Создать
          </button>
        </form>
      </div>
    </div>
  );
}
