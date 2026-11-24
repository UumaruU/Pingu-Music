import { useState } from "react";
import { Plus } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { PlaylistCard } from "../components/PlaylistCard";
import {
  PLAYLIST_COVER_ACCENTS,
  PlaylistDetailsDraft,
} from "../services/playlistDetails";
import { Playlist } from "../types";

interface PlaylistsPageProps {
  playlists: Playlist[];
  onCreatePlaylist: (name: string, details?: PlaylistDetailsDraft) => void;
  onUpdatePlaylist: (playlistId: string, patch: PlaylistDetailsDraft) => void;
  onOpenPlaylist: (playlistId: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
}

export function PlaylistsPage({
  playlists,
  onCreatePlaylist,
  onUpdatePlaylist,
  onOpenPlaylist,
  onDeletePlaylist,
}: PlaylistsPageProps) {
  const [name, setName] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverAccent, setCoverAccent] = useState(PLAYLIST_COVER_ACCENTS[0]);
  const hasPlaylists = playlists.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Плейлисты</h1>
          {hasPlaylists ? <p className="mt-1 text-sm text-white/45">{playlists.length} плейлистов</p> : null}
        </div>
        <form
          className="grid w-full gap-3 rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-3 sm:max-w-[620px] sm:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const playlistName = name.trim();

            if (!playlistName) {
              return;
            }

            onCreatePlaylist(playlistName, { coverUrl, coverAccent });
            setName("");
            setCoverUrl("");
            setCoverAccent(PLAYLIST_COVER_ACCENTS[0]);
          }}
        >
          <div className="min-w-0 space-y-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Название плейлиста"
              className="w-full rounded-[16px] border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/35 focus:border-white/25"
            />
            <input
              value={coverUrl}
              onChange={(event) => setCoverUrl(event.target.value)}
              placeholder="Ссылка на обложку"
              className="w-full rounded-[16px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/25"
            />
            <div className="flex gap-2">
              {PLAYLIST_COVER_ACCENTS.map((accent) => (
                <button
                  key={accent}
                  type="button"
                  onClick={() => setCoverAccent(accent)}
                  className={`h-6 w-6 rounded-full border transition ${
                    coverAccent === accent ? "scale-105 border-white" : "border-white/20 hover:border-white/55"
                  }`}
                  style={{ backgroundColor: accent }}
                  title={accent}
                />
              ))}
            </div>
          </div>
          <button
            type="submit"
            className="inspires-focus-ring inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-white text-black transition hover:bg-white/90"
            title="Создать плейлист"
          >
            <Plus size={19} />
          </button>
        </form>
      </div>

      {!hasPlaylists ? (
        <section className="rounded-[26px] border border-white/[0.08] bg-white/[0.03] p-8 shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
          <p className="max-w-2xl text-sm leading-7 text-white/55">
            Создавайте подборки, добавляйте обложки и меняйте оформление без выхода из коллекции.
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
              onUpdate={(patch) => onUpdatePlaylist(playlist.id, patch)}
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
