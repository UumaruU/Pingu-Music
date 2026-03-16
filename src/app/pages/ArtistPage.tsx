import { ReactNode } from "react";
import { ArrowLeft, Disc3 } from "lucide-react";
import { CanonicalTrackList } from "../components/CanonicalTrackList";
import { EmptyState } from "../components/EmptyState";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { TrackList } from "../components/TrackList";
import { Artist, CanonicalTrack, EntityLoadStatus, Release, Track } from "../types";

interface ArtistPageProps {
  artist: Artist | undefined;
  status: EntityLoadStatus;
  tracksStatus: EntityLoadStatus;
  tracks: Track[];
  tracksById: Record<string, Track>;
  canonicalTracks: CanonicalTrack[];
  albums: Release[];
  singles: Release[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlay: (trackId: string, queueIds: string[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (trackId: string) => void;
  onShowLyrics: (trackId: string) => void;
  onOpenArtist: (trackId: string, artistName?: string) => void;
  onOpenRelease: (releaseId: string) => void;
  onBack: () => void;
}

function getActivityLabel(artist: Artist | undefined) {
  if (!artist?.beginDate && !artist?.endDate) {
    return "Неизвестно";
  }

  return [artist.beginDate || "?", artist.endDate || "по настоящее время"].join(" - ");
}

function getReleaseKindLabel(kind: Release["kind"]) {
  if (kind === "single") {
    return "Сингл";
  }
  if (kind === "album") {
    return "Альбом";
  }
  return "Релиз";
}

function getReleaseTimestamp(date: string | undefined) {
  if (!date) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(date);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function ReleaseSection({
  title,
  icon,
  releases,
  featuredRelease,
  emptyTitle,
  emptyDescription,
  onOpenRelease,
}: {
  title: string;
  icon: ReactNode;
  releases: Release[];
  featuredRelease?: Release;
  emptyTitle: string;
  emptyDescription: string;
  onOpenRelease: (releaseId: string) => void;
}) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-base font-semibold text-white">{title}</h3>
        </div>
        <span className="text-xs text-white/45">{releases.length}</span>
      </div>

      {!releases.length ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
          <p className="text-sm font-medium text-white/75">{emptyTitle}</p>
          <p className="mt-1 text-xs leading-6 text-white/45">{emptyDescription}</p>
        </div>
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-[248px_minmax(0,1fr)]">
          <div className="hidden lg:block">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              <div className="aspect-square w-full bg-white/[0.04]">
                {featuredRelease?.coverUrl ? (
                  <ImageWithFallback
                    src={featuredRelease.coverUrl}
                    alt={featuredRelease.title || "Обложка исполнителя"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-cyan-100/70">
                    <Disc3 size={36} />
                  </div>
                )}
              </div>
              <div className="border-t border-white/10 px-2.5 py-1.5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Последний релиз</p>
                <p className="mt-0.5 truncate text-base text-white/90">{featuredRelease?.title || "Нет данных"}</p>
              </div>
            </div>
          </div>

          <div className="scrollbar-none max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
            {releases.map((release) => (
              <button
                key={release.id}
                type="button"
                onClick={() => onOpenRelease(release.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-2.5 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/12 text-cyan-100">
                  {release.coverUrl ? (
                    <ImageWithFallback
                      src={release.coverUrl}
                      alt={release.title}
                      className="h-10 w-10 rounded-xl object-cover"
                    />
                  ) : (
                    <Disc3 size={18} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{release.title}</p>
                  <p className="mt-1 text-xs text-white/45">
                    <span>{release.date || "Дата неизвестна"}</span>
                    {release.country ? <span>{` • ${release.country}`}</span> : null}
                    <span className="text-white/35">{` • ${getReleaseKindLabel(release.kind)}`}</span>
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function ArtistPage({
  artist,
  status,
  tracksStatus,
  tracks,
  tracksById,
  canonicalTracks,
  albums,
  singles,
  onOpenRelease,
  onBack,
  ...trackListProps
}: ArtistPageProps) {
  const hasCanonicalTracks = canonicalTracks.length > 0;
  const mergedReleases = [
    ...albums.map((release) => ({ ...release, kind: release.kind ?? "album" })),
    ...singles.map((release) => ({ ...release, kind: release.kind ?? "single" })),
  ]
    .filter(
      (release, index, source) =>
        index ===
        source.findIndex(
          (item) => (item.musicBrainzReleaseId || item.id) === (release.musicBrainzReleaseId || release.id),
        ),
    );

  const latestRelease = mergedReleases.reduce<Release | undefined>((latest, release) => {
    if (!latest) {
      return release;
    }

    return getReleaseTimestamp(release.date) > getReleaseTimestamp(latest.date)
      ? release
      : latest;
  }, undefined);
  const fallbackReleaseWithCover = mergedReleases.find((release) => !!release.coverUrl);
  const featuredRelease = latestRelease?.coverUrl ? latestRelease : fallbackReleaseWithCover ?? latestRelease;

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),linear-gradient(135deg,#111827,#0b0d12_58%,#0f172a)] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.45)] lg:p-6">
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="flex h-full flex-col gap-4">
            <button
              type="button"
              onClick={onBack}
              className="self-start inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-sm text-white/70 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-white"
            >
              <ArrowLeft size={16} />
              Назад
            </button>
            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.28em] text-cyan-200/65">Исполнитель</div>
              <h1 className="text-4xl font-semibold text-white">
                {artist?.name || (status === "loading" ? "Загрузка..." : "Исполнитель не найден")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
                {artist?.disambiguation ||
                  "Детальная карточка артиста, локально известные треки и релизы из MusicBrainz."}
              </p>
            </div>

            <div className="mt-auto space-y-2.5 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-baseline justify-between gap-3 border-b border-white/8 pb-1.5">
                <span className="text-xs uppercase tracking-[0.2em] text-white/40">Страна</span>
                <span className="text-sm text-white/90">{artist?.country || artist?.area || "Неизвестно"}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-white/8 pb-1.5">
                <span className="text-xs uppercase tracking-[0.2em] text-white/40">Тип</span>
                <span className="text-sm text-white/90">{artist?.type || "Неизвестно"}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-white/8 pb-1.5">
                <span className="text-xs uppercase tracking-[0.2em] text-white/40">Годы активности</span>
                <span className="text-right text-sm text-white/90">{getActivityLabel(artist)}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="pt-1 text-xs uppercase tracking-[0.2em] text-white/40">Теги</span>
                <div className="flex flex-wrap justify-end gap-2">
                  {artist?.tags?.length ? (
                    artist.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-white/70">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-white/45">Теги пока недоступны.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid h-fit gap-3">
            <ReleaseSection
              title="Альбомы"
              icon={<Disc3 size={16} className="text-cyan-100" />}
              releases={mergedReleases}
              featuredRelease={featuredRelease}
              emptyTitle={status === "loading" ? "Загрузка релизов..." : "Релизы не найдены"}
              emptyDescription="Здесь отображаются альбомы и синглы исполнителя."
              onOpenRelease={onOpenRelease}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Треки</h2>
            <p className="mt-1 text-sm text-white/50">Локально известные треки этого исполнителя.</p>
          </div>
        </div>
        {(status === "loading" && !artist) || (tracksStatus === "loading" && artist && !tracks.length) ? (
          <EmptyState title="Загрузка..." description="Собираем карточку исполнителя и локальные треки." />
        ) : null}
        {artist && hasCanonicalTracks ? (
          <CanonicalTrackList
            canonicalTracks={canonicalTracks}
            tracksById={tracksById}
            {...trackListProps}
          />
        ) : null}
        {artist && !hasCanonicalTracks && tracks.length ? <TrackList tracks={tracks} {...trackListProps} /> : null}
        {status !== "loading" && tracksStatus !== "loading" && (!artist || !tracks.length) ? (
          <EmptyState
            title={artist ? "Треки не найдены" : "Исполнитель не найден"}
            description={
              artist
                ? "Для этого исполнителя пока нет треков в локальной базе."
                : "Не удалось открыть карточку исполнителя."
            }
          />
        ) : null}
      </section>
    </div>
  );
}
