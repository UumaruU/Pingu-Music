import { useState } from "react";
import { ArrowLeft, ChevronRight, Heart, Pause, Play, Plus } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { PlaylistCard } from "../components/PlaylistCard";
import {
  PLAYLIST_COVER_ACCENTS,
  PlaylistDetailsDraft,
} from "../services/playlistDetails";
import { TrackList } from "../components/TrackList";
import { Playlist, Track } from "../types";
import { formatDuration } from "../utils/format";
import {
  buildCollectionSections,
  getFavoriteTrackPreview,
} from "./favoritesCollection";

interface FavoritesPageProps {
  tracks: Track[];
  playlists: Playlist[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlay: (trackId: string, queueIds: string[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (trackId: string) => void;
  onShowLyrics: (trackId: string) => void;
  onOpenArtist: (trackId: string, artistName?: string) => void;
  onCreatePlaylist: (name: string, details?: PlaylistDetailsDraft) => void;
  onUpdatePlaylist: (playlistId: string, patch: PlaylistDetailsDraft) => void;
  onOpenPlaylist: (playlistId: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
}

type ArtistSummary = {
  name: string;
  count: number;
  trackId?: string;
};

function pluralizeTracks(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) {
    return "трек";
  }

  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return "трека";
  }

  return "треков";
}

function getPrimaryArtist(track: Track) {
  return track.artist.split(/[,/&]/)[0]?.trim() || track.artist.trim();
}

function getFavoriteArtists(tracks: Track[]) {
  const artistMap = new Map<string, ArtistSummary>();

  tracks.forEach((track) => {
    const name = getPrimaryArtist(track);
    if (!name) {
      return;
    }

    const existing = artistMap.get(name);
    if (existing) {
      existing.count += 1;
      return;
    }

    artistMap.set(name, { name, count: 1, trackId: track.id });
  });

  return Array.from(artistMap.values())
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, 8);
}

function CollectionHeader() {
  return (
    <div>
      <h1 className="text-[32px] font-semibold tracking-[-0.01em] text-white sm:text-[40px]">
        Коллекция
      </h1>
      <p className="mt-1 text-sm font-medium text-white/45">
        У вашей музыки есть <span className="text-[var(--im-pink)]">цвет</span>
      </p>
    </div>
  );
}

function SectionHeader({
  title,
  caption,
}: {
  title: string;
  caption?: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {caption ? <p className="mt-1 text-sm text-white/45">{caption}</p> : null}
    </div>
  );
}

function LikedArtwork({ tracks }: { tracks: Track[] }) {
  const firstCover = tracks[0]?.coverUrl;

  return (
    <div className="relative h-[58px] w-[58px] shrink-0 overflow-hidden rounded-[10px] bg-[radial-gradient(circle_at_25%_20%,#ffdbbc_0,#ff6d5f_28%,#d8134c_58%,#31102a_100%)] shadow-[0_16px_34px_rgba(216,19,76,0.28)]">
      {firstCover ? (
        <ImageWithFallback
          src={firstCover}
          alt="Мне нравится"
          className="h-full w-full object-cover opacity-35 mix-blend-screen"
        />
      ) : null}
      <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_40%_35%,rgba(255,255,255,0.5),transparent_34%)]">
        <Heart size={30} className="fill-white text-white drop-shadow-[0_8px_16px_rgba(0,0,0,0.32)]" />
      </div>
    </div>
  );
}

function LikedTrackPreviewCard({
  track,
  isActive,
  isPlaying,
  queueIds,
  onPlay,
  onToggleFavorite,
}: {
  track: Track;
  isActive: boolean;
  isPlaying: boolean;
  queueIds: string[];
  onPlay: (trackId: string, queueIds: string[]) => void;
  onToggleFavorite: (trackId: string) => void;
}) {
  return (
    <article
      className={`group grid min-w-0 grid-cols-[44px_1fr_auto] items-center gap-3 rounded-[14px] p-2 transition ${
        isActive ? "bg-white/[0.07]" : "hover:bg-white/[0.045]"
      }`}
    >
      <button
        type="button"
        onClick={() => onPlay(track.id, queueIds)}
        className="relative h-11 w-11 overflow-hidden rounded-[9px]"
      >
        <ImageWithFallback src={track.coverUrl} alt={track.title} className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100">
          {isActive && isPlaying ? (
            <Pause size={16} className="fill-white text-white" />
          ) : (
            <Play size={16} className="fill-white text-white" />
          )}
        </span>
      </button>

      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{track.title}</div>
        <div className="mt-1 truncate text-sm font-semibold text-white/42">{track.artist}</div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onToggleFavorite(track.id)}
          className="rounded-full p-2 text-white/55 transition hover:bg-white/8 hover:text-white"
          title="Удалить из избранного"
        >
          <Heart size={17} className="fill-current" />
        </button>
        <span className="hidden min-w-[42px] text-right text-sm font-semibold text-white/36 sm:block">
          {formatDuration(track.duration)}
        </span>
      </div>
    </article>
  );
}

function ArtistCard({
  artist,
  index,
  onOpenArtist,
}: {
  artist: ArtistSummary;
  index: number;
  onOpenArtist: (trackId: string, artistName?: string) => void;
}) {
  const colors = [
    "bg-[var(--im-purple)]",
    "bg-[var(--im-green)]",
    "bg-[var(--im-pink)]",
    "bg-[var(--im-cyan)]",
  ];

  return (
    <button
      type="button"
      disabled={!artist.trackId}
      onClick={() => {
        if (artist.trackId) {
          onOpenArtist(artist.trackId, artist.name);
        }
      }}
      className="inspires-focus-ring flex min-w-0 items-center gap-3 rounded-[16px] p-2 text-left transition hover:bg-white/[0.045] disabled:cursor-default"
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${colors[index % colors.length]} text-sm font-semibold text-black`}>
        {artist.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{artist.name}</div>
        <div className="mt-1 text-xs text-white/42">
          {artist.count} {pluralizeTracks(artist.count)}
        </div>
      </div>
      <ChevronRight size={16} className="text-white/30" />
    </button>
  );
}

function PlaylistCreateForm({
  onCreatePlaylist,
}: {
  onCreatePlaylist: (name: string, details?: PlaylistDetailsDraft) => void;
}) {
  const [name, setName] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverAccent, setCoverAccent] = useState(PLAYLIST_COVER_ACCENTS[0]);

  return (
    <form
      className="grid w-full gap-3 rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-3 sm:max-w-[620px] sm:grid-cols-[84px_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        const playlistName = name.trim();

        if (!playlistName) {
          return;
        }

        onCreatePlaylist(playlistName, {
          coverUrl,
          coverAccent,
        });
        setName("");
        setCoverUrl("");
        setCoverAccent(PLAYLIST_COVER_ACCENTS[0]);
      }}
    >
      <div
        className="relative h-[84px] w-[84px] overflow-hidden rounded-[22px] border border-white/[0.09]"
        style={{
          background: `radial-gradient(circle at 30% 18%, rgba(255,255,255,0.34), transparent 28%), linear-gradient(135deg, ${coverAccent}, #101114 72%)`,
        }}
      >
        {coverUrl.trim() ? (
          <ImageWithFallback src={coverUrl} alt="Новый плейлист" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white">
            <Plus size={24} />
          </div>
        )}
      </div>

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
        className="inspires-focus-ring inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-white text-black transition hover:bg-white/90 sm:self-start"
        title="Создать плейлист"
      >
        <Plus size={19} />
      </button>
    </form>
  );
}

export function FavoritesPage(props: FavoritesPageProps) {
  const [isLikedTracksOpen, setLikedTracksOpen] = useState(false);
  const hasFavorites = props.tracks.length > 0;
  const favoriteArtists = getFavoriteArtists(props.tracks);
  const previewTracks = getFavoriteTrackPreview(props.tracks);
  const queueIds = props.tracks.map((track) => track.id);
  const collectionSections = buildCollectionSections({
    favoriteTracks: props.tracks,
    favoriteArtistCount: favoriteArtists.length,
    playlists: props.playlists,
  });
  const likedSection = collectionSections.find((section) => section.id === "liked-tracks");
  const playlistSection = collectionSections.find((section) => section.id === "playlists");

  if (isLikedTracksOpen) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setLikedTracksOpen(false)}
          className="inspires-focus-ring inline-flex items-center gap-2 rounded-full px-1 py-1 text-sm font-semibold text-white/55 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Коллекция
        </button>

        <section className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <LikedArtwork tracks={props.tracks} />
            <div className="min-w-0">
              <h1 className="truncate text-[30px] font-semibold tracking-[-0.01em] text-white sm:text-[42px]">
                Мне нравится
              </h1>
              <p className="mt-1 text-sm font-semibold text-white/45">
                {props.tracks.length} {pluralizeTracks(props.tracks.length)}
              </p>
            </div>
          </div>

          {hasFavorites ? (
            <button
              type="button"
              onClick={() => props.onPlay(props.tracks[0].id, queueIds)}
              className="inspires-focus-ring inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              <Play size={16} className="fill-black" />
              Слушать всё
            </button>
          ) : null}
        </section>

        {hasFavorites ? (
          <TrackList {...props} reverseIndex />
        ) : (
          <EmptyState
            title="Пока нет любимых песен"
            description="Добавьте треки в избранное, и полный список появится здесь."
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <CollectionHeader />

      <section className="space-y-4">
        <button
          type="button"
          onClick={() => setLikedTracksOpen(true)}
          className="inspires-focus-ring group flex w-full max-w-xl items-center gap-3 rounded-[18px] p-1 text-left transition hover:bg-white/[0.04]"
        >
          <LikedArtwork tracks={props.tracks} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-2xl font-semibold tracking-[-0.01em] text-white">
              {likedSection?.title ?? "Мне нравится"}
            </span>
            <span className="mt-1 block text-sm font-semibold text-white/45">
              {likedSection?.count ?? 0} {pluralizeTracks(likedSection?.count ?? 0)}
            </span>
          </span>
          <ChevronRight size={24} className="text-white/45 transition group-hover:translate-x-0.5 group-hover:text-white" />
        </button>

        {hasFavorites ? (
          <div className="grid gap-x-7 gap-y-2 md:grid-cols-2 xl:grid-cols-4">
            {previewTracks.map((track) => (
              <LikedTrackPreviewCard
                key={track.id}
                track={track}
                isActive={props.currentTrackId === track.id}
                isPlaying={props.currentTrackId === track.id && props.isPlaying}
                queueIds={queueIds}
                onPlay={props.onPlay}
                onToggleFavorite={props.onToggleFavorite}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[18px] border border-dashed border-white/[0.08] bg-white/[0.02] p-6 text-sm text-white/45">
            Любимые песни появятся здесь после нажатия на сердечко.
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="Любимые артисты"
          caption="Артисты собираются из треков в разделе «Мне нравится»."
        />
        {favoriteArtists.length ? (
          <div className="grid gap-x-7 gap-y-2 md:grid-cols-2 xl:grid-cols-4">
            {favoriteArtists.map((artist, index) => (
              <ArtistCard
                key={artist.name}
                artist={artist}
                index={index}
                onOpenArtist={props.onOpenArtist}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[18px] border border-dashed border-white/[0.08] bg-white/[0.02] p-6 text-sm text-white/45">
            Артисты появятся после добавления любимых песен.
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader
            title={playlistSection?.title ?? "Плейлисты"}
            caption={
              props.playlists.length
                ? `${props.playlists.length} плейлистов в вашей коллекции`
                : "Создайте подборку и добавляйте в неё треки из поиска, главной или избранного."
            }
          />
          <PlaylistCreateForm onCreatePlaylist={props.onCreatePlaylist} />
        </div>

        {props.playlists.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {props.playlists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                onOpen={() => props.onOpenPlaylist(playlist.id)}
                onUpdate={(patch) => props.onUpdatePlaylist(playlist.id, patch)}
                onDelete={() => props.onDeletePlaylist(playlist.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Создайте свой первый плейлист"
            description="Плейлисты теперь находятся внизу коллекции, рядом с избранными треками и артистами."
          />
        )}
      </section>
    </div>
  );
}
