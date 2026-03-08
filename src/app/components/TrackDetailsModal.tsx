import { X } from "lucide-react";
import { Artist, Lyrics, Release, Track } from "../types";
import { splitTrackArtists } from "../utils/artists";
import { formatDuration } from "../utils/format";

interface TrackDetailsModalProps {
  track: Track;
  artist?: Artist;
  release?: Release;
  lyrics?: Lyrics;
  onClose: () => void;
  onOpenArtist: (artistName?: string) => void;
}

function renderLyricsContent(lyrics: Lyrics | undefined) {
  if (!lyrics || lyrics.status === "loading") {
    return <div className="py-12 text-center text-white/45">Загрузка текста...</div>;
  }

  if (lyrics.status === "failed") {
    return (
      <div className="py-12 text-center text-white/45">
        {lyrics.error || "Не удалось загрузить текст"}
      </div>
    );
  }

  if (lyrics.status === "missing" || !lyrics.plain) {
    return <div className="py-12 text-center text-white/45">Текст не найден</div>;
  }

  return <div className="whitespace-pre-line text-sm leading-7 text-white/80">{lyrics.plain}</div>;
}

export function TrackDetailsModal({
  track,
  artist,
  release,
  lyrics,
  onClose,
  onOpenArtist,
}: TrackDetailsModalProps) {
  const artistNames = splitTrackArtists(track.artist);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-[30px] border border-white/10 bg-[#11141b] shadow-[0_24px_100px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">{track.title}</h2>
            {artistNames.length <= 1 ? (
              <button
                type="button"
                onClick={() => onOpenArtist(artistNames[0])}
                className="mt-2 text-sm text-cyan-200/80 transition hover:text-cyan-100"
              >
                {artist?.name || track.artist}
              </button>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-x-1 text-sm text-cyan-200/80">
                {artistNames.map((artistName, index) => (
                  <div key={`${track.id}:header:${artistName}`} className="contents">
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <div className="grid max-h-[calc(88vh-100px)] gap-6 overflow-y-auto p-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-6 text-xs uppercase tracking-[0.3em] text-cyan-200/60">Метаданные</div>
            <dl className="grid gap-4">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <dt className="text-xs uppercase tracking-[0.24em] text-white/40">Трек</dt>
                <dd className="mt-2 text-lg font-medium text-white">{track.title}</dd>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <dt className="text-xs uppercase tracking-[0.24em] text-white/40">Исполнитель</dt>
                <dd className="mt-2 flex flex-wrap items-center gap-x-1">
                  {artistNames.map((artistName, index) => (
                    <div key={`${track.id}:meta:${artistName}`} className="contents">
                      <button
                        type="button"
                        onClick={() => onOpenArtist(artistName)}
                        className="text-left text-base text-cyan-100 transition hover:text-white"
                      >
                        {artistName}
                      </button>
                      {index < artistNames.length - 1 ? <span className="text-white/35">,</span> : null}
                    </div>
                  ))}
                </dd>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <dt className="text-xs uppercase tracking-[0.24em] text-white/40">Альбом</dt>
                <dd className="mt-2 text-base text-white">
                  {release?.title || track.albumTitle || "Неизвестно"}
                </dd>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <dt className="text-xs uppercase tracking-[0.24em] text-white/40">Длительность</dt>
                  <dd className="mt-2 text-base text-white">{formatDuration(track.duration)}</dd>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <dt className="text-xs uppercase tracking-[0.24em] text-white/40">Дата релиза</dt>
                  <dd className="mt-2 text-base text-white">
                    {release?.date || track.releaseDate || "Неизвестно"}
                  </dd>
                </div>
              </div>
            </dl>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-6 text-xs uppercase tracking-[0.3em] text-cyan-200/60">Текст песни</div>
            {renderLyricsContent(lyrics)}
          </section>
        </div>
      </div>
    </div>
  );
}
