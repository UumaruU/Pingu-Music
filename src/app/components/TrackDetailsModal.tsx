import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Artist, Lyrics, Release, Track } from "../types";
import { splitTrackArtists } from "../utils/artists";
import { formatDuration } from "../utils/format";

interface TrackDetailsModalProps {
  track: Track;
  artist?: Artist;
  release?: Release;
  lyrics?: Lyrics;
  currentTrackId: string | null;
  currentProgress: number;
  onClose: () => void;
  onOpenArtist: (artistName?: string) => void;
  onSeekToLyrics: (seconds: number) => void;
}

interface SyncedLyricLine {
  id: string;
  time: number;
  text: string;
}

function parseSyncedLyrics(syncedText: string | undefined) {
  if (!syncedText?.trim()) {
    return [] as SyncedLyricLine[];
  }

  const lines: SyncedLyricLine[] = [];
  const timestampPattern = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  syncedText.split(/\r?\n/).forEach((rawLine, lineIndex) => {
    const matches = Array.from(rawLine.matchAll(timestampPattern));

    if (!matches.length) {
      return;
    }

    const text = rawLine.replace(timestampPattern, "").trim();

    if (!text) {
      return;
    }

    matches.forEach((match, matchIndex) => {
      const minutes = Number.parseInt(match[1], 10);
      const seconds = Number.parseInt(match[2], 10);
      const fractionRaw = match[3] ?? "";
      const fractionLength = fractionRaw.length;
      const fraction = fractionLength
        ? Number.parseInt(fractionRaw, 10) / 10 ** fractionLength
        : 0;
      const time = minutes * 60 + seconds + fraction;

      if (!Number.isFinite(time)) {
        return;
      }

      lines.push({
        id: `${lineIndex}:${matchIndex}:${time.toFixed(3)}`,
        time,
        text,
      });
    });
  });

  return lines.sort((left, right) => left.time - right.time);
}

function getActiveSyncedLineIndex(lines: SyncedLyricLine[], progress: number) {
  if (!lines.length || !Number.isFinite(progress)) {
    return -1;
  }

  let activeIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (progress + 0.05 >= lines[index].time) {
      activeIndex = index;
    } else {
      break;
    }
  }

  return activeIndex;
}

function formatLyricsTimestamp(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function TrackDetailsModal({
  track,
  artist,
  release,
  lyrics,
  currentTrackId,
  currentProgress,
  onClose,
  onOpenArtist,
  onSeekToLyrics,
}: TrackDetailsModalProps) {
  const artistNames = splitTrackArtists(track.artist);
  const syncedLines = useMemo(() => parseSyncedLyrics(lyrics?.synced), [lyrics?.synced]);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const lyricsLineRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [isManualLyricsScroll, setIsManualLyricsScroll] = useState(false);
  const isCurrentTrack = currentTrackId === track.id;
  const activeLineIndex = useMemo(
    () => (isCurrentTrack ? getActiveSyncedLineIndex(syncedLines, currentProgress) : -1),
    [currentProgress, isCurrentTrack, syncedLines],
  );

  useEffect(() => {
    setIsManualLyricsScroll(false);
  }, [track.id]);

  useEffect(() => {
    if (isManualLyricsScroll || !isCurrentTrack || activeLineIndex < 0 || !syncedLines.length) {
      return;
    }

    const activeLine = syncedLines[activeLineIndex];
    const container = lyricsContainerRef.current;
    const activeElement = activeLine ? lyricsLineRefs.current[activeLine.id] : null;

    if (!container || !activeElement) {
      return;
    }

    const centeredTop =
      activeElement.offsetTop - container.clientHeight / 2 + activeElement.clientHeight / 2;

    container.scrollTo({
      top: Math.max(0, centeredTop),
      behavior: "smooth",
    });
  }, [activeLineIndex, isCurrentTrack, isManualLyricsScroll, syncedLines]);

  const switchToManualMode = () => {
    if (!syncedLines.length || isManualLyricsScroll) {
      return;
    }
    setIsManualLyricsScroll(true);
  };

  const renderLyricsContent = () => {
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

    if (lyrics.status === "missing" || (!lyrics.plain && !syncedLines.length)) {
      return <div className="py-12 text-center text-white/45">Текст не найден</div>;
    }

    if (syncedLines.length) {
      return (
        <div className="flex h-[min(50vh,500px)] flex-col">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-xs text-white/40">
              {isManualLyricsScroll
                ? "Ручной режим: прокручивайте и нажимайте строку для перемотки."
                : "Автопрокрутка по активной строке."}
            </p>
            <button
              type="button"
              onClick={() => setIsManualLyricsScroll((prev) => !prev)}
              className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 transition hover:border-cyan-300/45 hover:text-cyan-100"
            >
              {isManualLyricsScroll ? "Вернуться к автопрокрутке" : "Ручная прокрутка"}
            </button>
          </div>
          <div
            ref={lyricsContainerRef}
            onWheel={switchToManualMode}
            className="scrollbar-none relative flex-1 overflow-y-auto"
          >
            <div className="pointer-events-none sticky top-0 z-[1] h-16 bg-gradient-to-b from-[#11141b] to-transparent" />
            <div className="space-y-2 px-1 pb-14">
              {syncedLines.map((line, index) => {
                const isActiveLine = activeLineIndex === index;
                const distanceFromActive =
                  activeLineIndex < 0 ? 99 : Math.abs(index - activeLineIndex);
                const fadedOpacity = isActiveLine
                  ? 1
                  : distanceFromActive <= 1
                    ? 0.54
                    : distanceFromActive <= 2
                      ? 0.34
                      : 0.18;

                return (
                  <button
                    key={line.id}
                    type="button"
                    ref={(element) => {
                      lyricsLineRefs.current[line.id] = element;
                    }}
                    onClick={() => onSeekToLyrics(line.time)}
                    className={`group flex w-full rounded-2xl px-3 text-left transition ${
                      isManualLyricsScroll
                        ? "items-start gap-3 py-2.5 text-white/80 hover:bg-white/[0.06] hover:text-white"
                        : "justify-center py-4"
                    }`}
                    style={isManualLyricsScroll ? undefined : { opacity: fadedOpacity }}
                  >
                    {isManualLyricsScroll ? (
                      <span className="w-12 shrink-0 pt-0.5 text-xs text-white/40">
                        {formatLyricsTimestamp(line.time)}
                      </span>
                    ) : null}
                    <span
                      className={`${
                        isManualLyricsScroll
                          ? "text-[1.15rem] font-medium leading-7"
                          : "text-center text-[clamp(1.65rem,3.7vw,3.15rem)] font-semibold leading-[1.14]"
                      } ${isActiveLine ? "text-white" : "text-white/85"} transition`}
                    >
                      {line.text}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="pointer-events-none sticky bottom-0 z-[1] h-16 bg-gradient-to-t from-[#11141b] to-transparent" />
          </div>
        </div>
      );
    }

    return <div className="whitespace-pre-line text-sm leading-7 text-white/80">{lyrics.plain}</div>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[30px] border border-white/10 bg-[#11141b] shadow-[0_24px_100px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
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

        <div className="grid max-h-[calc(92vh-98px)] gap-5 overflow-hidden p-5 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 text-xs uppercase tracking-[0.3em] text-cyan-200/60">Метаданные</div>
            <dl className="grid gap-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                <dt className="text-xs uppercase tracking-[0.24em] text-white/40">Трек</dt>
                <dd className="mt-2 text-lg font-medium text-white">{track.title}</dd>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
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
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                <dt className="text-xs uppercase tracking-[0.24em] text-white/40">Альбом</dt>
                <dd className="mt-2 text-base text-white">
                  {release?.title || track.albumTitle || "Неизвестно"}
                </dd>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                  <dt className="text-xs uppercase tracking-[0.24em] text-white/40">Длительность</dt>
                  <dd className="mt-2 text-base text-white">{formatDuration(track.duration)}</dd>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                  <dt className="text-xs uppercase tracking-[0.24em] text-white/40">Дата релиза</dt>
                  <dd className="mt-2 text-base text-white">
                    {release?.date || track.releaseDate || "Неизвестно"}
                  </dd>
                </div>
              </div>
            </dl>
          </section>

          <section className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 text-xs uppercase tracking-[0.3em] text-cyan-200/60">Текст песни</div>
            {renderLyricsContent()}
          </section>
        </div>
      </div>
    </div>
  );
}
