import { EmptyState } from "../components/EmptyState";
import { PlaylistCard } from "../components/PlaylistCard";
import { Playlist } from "../types";

interface PlaylistsPageProps {
  playlists: Playlist[];
  onCreatePlaylist: (name: string) => void;
  onOpenPlaylist: (playlistId: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
}

export function PlaylistsPage({
  playlists,
  onCreatePlaylist,
  onOpenPlaylist,
  onDeletePlaylist,
}: PlaylistsPageProps) {
  const hasPlaylists = playlists.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Плейлисты</h1>
          {hasPlaylists ? <p className="mt-1 text-sm text-white/45">{playlists.length} плейлистов</p> : null}
        </div>
        <form
          className="flex w-full max-w-md gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const playlistName = `${formData.get("playlist-name") ?? ""}`.trim();
            if (!playlistName) {
              return;
            }
            onCreatePlaylist(playlistName);
            event.currentTarget.reset();
          }}
        >
          <input
            name="playlist-name"
            placeholder="Новый плейлист"
            className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-cyan-300/40"
          />
          <button type="submit" className="rounded-2xl bg-cyan-300 px-4 py-3 font-medium text-slate-950 transition hover:bg-cyan-200">
            Создать
          </button>
        </form>
      </div>

      {!hasPlaylists ? (
        <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <p className="max-w-2xl text-sm leading-7 text-white/55">
            Создавайте подборки, открывайте детальную страницу плейлиста и управляйте списком треков без выхода из приложения.
          </p>
        </section>
      ) : null}

      {hasPlaylists ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {playlists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              onOpen={() => onOpenPlaylist(playlist.id)}
              onDelete={() => onDeletePlaylist(playlist.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="Создайте свой первый плейлист" description="После создания вы сможете добавлять треки прямо из главной страницы, поиска или избранного." />
      )}
    </div>
  );
}
