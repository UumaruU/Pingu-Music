import { FormEvent, useState } from "react";
import { Check, Music4, Pencil, Trash2, X } from "lucide-react";
import { PLAYLIST_COVER_ACCENTS, PlaylistDetailsDraft } from "../services/playlistDetails";
import { Playlist } from "../types";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface PlaylistCardProps {
  playlist: Playlist;
  onOpen: () => void;
  onDelete: () => void;
  onUpdate: (patch: PlaylistDetailsDraft) => void;
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

function PlaylistCover({
  playlist,
  size = "large",
}: {
  playlist: Playlist;
  size?: "small" | "large";
}) {
  const accent = playlist.coverAccent ?? PLAYLIST_COVER_ACCENTS[0];
  const sizeClassName = size === "small" ? "h-12 w-12 rounded-[16px]" : "h-[118px] w-[118px] rounded-[26px]";

  return (
    <div
      className={`relative shrink-0 overflow-hidden border border-white/[0.08] shadow-[0_20px_54px_rgba(0,0,0,0.36)] ${sizeClassName}`}
      style={{
        background: `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.34), transparent 26%), linear-gradient(135deg, ${accent}, #101114 72%)`,
      }}
    >
      {playlist.coverUrl ? (
        <ImageWithFallback
          src={playlist.coverUrl}
          alt={playlist.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.18))]" />
      {!playlist.coverUrl ? (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <Music4 size={size === "small" ? 20 : 34} strokeWidth={2.1} />
        </div>
      ) : null}
    </div>
  );
}

export function PlaylistCard({ playlist, onOpen, onDelete, onUpdate }: PlaylistCardProps) {
  const [isEditing, setEditing] = useState(false);
  const [name, setName] = useState(playlist.name);
  const [coverUrl, setCoverUrl] = useState(playlist.coverUrl ?? "");
  const [coverAccent, setCoverAccent] = useState(
    playlist.coverAccent ?? PLAYLIST_COVER_ACCENTS[0],
  );

  const draftPlaylist: Playlist = {
    ...playlist,
    name: name.trim() || playlist.name,
    coverUrl: coverUrl.trim() || undefined,
    coverAccent,
  };

  const resetForm = () => {
    setName(playlist.name);
    setCoverUrl(playlist.coverUrl ?? "");
    setCoverAccent(playlist.coverAccent ?? PLAYLIST_COVER_ACCENTS[0]);
    setEditing(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    onUpdate({
      name,
      coverUrl,
      coverAccent,
    });
    setEditing(false);
  };

  return (
    <article className="group rounded-[26px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.022))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.34)] transition hover:border-white/[0.14] hover:bg-white/[0.05]">
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onOpen}
          className="inspires-focus-ring rounded-[26px] text-left"
          title="Открыть плейлист"
        >
          <PlaylistCover playlist={playlist} />
        </button>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <button type="button" onClick={onOpen} className="min-w-0 text-left">
              <div className="truncate text-xl font-semibold tracking-[-0.01em] text-white">
                {playlist.name}
              </div>
              <div className="mt-1 text-sm font-semibold text-white/44">
                {playlist.trackIds.length} {pluralizeTracks(playlist.trackIds.length)}
              </div>
            </button>

            <div className="flex shrink-0 items-center gap-1 opacity-75 transition group-hover:opacity-100">
              <button
                type="button"
                onClick={() => setEditing((value) => !value)}
                className="inspires-focus-ring rounded-full p-2 text-white/50 transition hover:bg-white/8 hover:text-white"
                title="Редактировать плейлист"
              >
                <Pencil size={17} />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="inspires-focus-ring rounded-full p-2 text-white/45 transition hover:bg-white/8 hover:text-rose-300"
                title="Удалить плейлист"
              >
                <Trash2 size={17} />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpen}
            className="mt-auto hidden rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-center text-xs font-semibold text-white/60 transition hover:bg-white/[0.07] hover:text-white sm:inline-flex sm:w-fit"
          >
            Открыть
          </button>
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-white/[0.07] pt-4">
          <div className="flex gap-3">
            <PlaylistCover playlist={draftPlaylist} size="small" />
            <div className="min-w-0 flex-1 space-y-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Название плейлиста"
                className="w-full rounded-[14px] border border-white/10 bg-black/20 px-3 py-2.5 text-sm font-semibold text-white outline-none transition placeholder:text-white/35 focus:border-white/25"
              />
              <input
                value={coverUrl}
                onChange={(event) => setCoverUrl(event.target.value)}
                placeholder="Ссылка на обложку"
                className="w-full rounded-[14px] border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/25"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {PLAYLIST_COVER_ACCENTS.map((accent) => (
                <button
                  key={accent}
                  type="button"
                  onClick={() => setCoverAccent(accent)}
                  className={`h-7 w-7 rounded-full border transition ${
                    coverAccent === accent ? "border-white scale-105" : "border-white/20 hover:border-white/55"
                  }`}
                  style={{ backgroundColor: accent }}
                  title={accent}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="inspires-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/60 transition hover:bg-white/[0.07] hover:text-white"
                title="Отменить"
              >
                <X size={17} />
              </button>
              <button
                type="submit"
                className="inspires-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90"
                title="Сохранить"
              >
                <Check size={17} />
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </article>
  );
}
