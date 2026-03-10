import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Music2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { BrandMark } from "./components/BrandMark";
import { AppVersionBadge } from "./components/AppVersionBadge";
import { PlayerBar } from "./components/PlayerBar";
import { SearchBar } from "./components/SearchBar";
import { Sidebar } from "./components/Sidebar";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { useHashRoute } from "./hooks/useHashRoute";
import { HomePage } from "./pages/HomePage";
import { useAppStore } from "./store/appStore";
import { useAuthStore } from "./store/authStore";
import { ListenHistoryEntry, RouteId, Track } from "./types";

type NowPlayingViewMode = "cover" | "details";

const FavoritesPage = lazy(() =>
  import("./pages/FavoritesPage").then((module) => ({ default: module.FavoritesPage })),
);
const HistoryPage = lazy(() =>
  import("./pages/HistoryPage").then((module) => ({ default: module.HistoryPage })),
);
const PlaylistDetailsPage = lazy(() =>
  import("./pages/PlaylistDetailsPage").then((module) => ({
    default: module.PlaylistDetailsPage,
  })),
);
const PlaylistsPage = lazy(() =>
  import("./pages/PlaylistsPage").then((module) => ({ default: module.PlaylistsPage })),
);
const SearchPage = lazy(() =>
  import("./pages/SearchPage").then((module) => ({ default: module.SearchPage })),
);
const ArtistPage = lazy(() =>
  import("./pages/ArtistPage").then((module) => ({ default: module.ArtistPage })),
);
const ReleasePage = lazy(() =>
  import("./pages/ReleasePage").then((module) => ({ default: module.ReleasePage })),
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = lazy(() =>
  import("./pages/RegisterPage").then((module) => ({ default: module.RegisterPage })),
);
const AddToPlaylistModal = lazy(() =>
  import("./components/AddToPlaylistModal").then((module) => ({
    default: module.AddToPlaylistModal,
  })),
);
const TrackDetailsModal = lazy(() =>
  import("./components/TrackDetailsModal").then((module) => ({
    default: module.TrackDetailsModal,
  })),
);
const NowPlayingModal = lazy(() =>
  import("./components/NowPlayingModal").then((module) => ({
    default: module.NowPlayingModal,
  })),
);

const loadArtistService = () =>
  import("./services/artistService").then((module) => module.artistService);
const loadCacheService = () =>
  import("./services/cacheService").then((module) => module.cacheService);
const loadDownloadService = () =>
  import("./services/downloadService").then((module) => module.downloadService);
const loadFavoritesService = () =>
  import("./services/favoritesService").then((module) => module.favoritesService);
const loadLyricsService = () =>
  import("./services/lyricsService").then((module) => module.lyricsService);
const loadMetadataEnrichmentService = () =>
  import("./services/metadataEnrichmentService").then(
    (module) => module.metadataEnrichmentService,
  );
const loadMusicService = () =>
  import("./services/musicService").then((module) => module.musicService);
const loadPlayerService = () =>
  import("./services/playerService").then((module) => module.playerService);
const loadPlaylistService = () =>
  import("./services/playlistService").then((module) => module.playlistService);

function getTracksByIds(tracks: Record<string, Track>, ids: string[]) {
  return ids.map((id) => tracks[id]).filter(Boolean);
}

function sortHistoryByDateDesc(left: ListenHistoryEntry, right: ListenHistoryEntry) {
  return Date.parse(right.listenedAt) - Date.parse(left.listenedAt);
}

function PageLoader() {
  return (
    <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-8 text-sm text-white/55 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      Загрузка...
    </div>
  );
}

function PlayerBarContainer({
  onAddToPlaylist,
  onOpenArtist,
  onOpenNowPlaying,
}: {
  onAddToPlaylist: (trackId: string) => void;
  onOpenArtist: (trackId: string, artistName?: string) => void;
  onOpenNowPlaying: (viewMode: NowPlayingViewMode) => void;
}) {
  const playerState = useAppStore(
    useShallow((state) => ({
      currentTrack: state.currentTrackId ? state.tracks[state.currentTrackId] ?? null : null,
      isPlaying: state.isPlaying,
      progress: state.progress,
      duration: state.duration,
      playerSettings: state.playerSettings,
    })),
  );

  return (
    <PlayerBar
      currentTrack={playerState.currentTrack}
      isPlaying={playerState.isPlaying}
      progress={playerState.progress}
      duration={playerState.duration}
      volume={playerState.playerSettings.volume}
      muted={playerState.playerSettings.muted}
      repeatMode={playerState.playerSettings.repeatMode}
      shuffleEnabled={playerState.playerSettings.shuffleEnabled}
      onPlayPause={() => {
        void loadPlayerService().then((playerService) => playerService.togglePlayPause());
      }}
      onNext={() => {
        void loadPlayerService().then((playerService) => playerService.playNext());
      }}
      onPrevious={() => {
        void loadPlayerService().then((playerService) => playerService.playPrevious());
      }}
      onSeek={(value) => {
        void loadPlayerService().then((playerService) => playerService.seek(value));
      }}
      onVolumeChange={(value) => {
        void loadPlayerService().then((playerService) => playerService.setVolume(value));
      }}
      onToggleMute={() => {
        void loadPlayerService().then((playerService) => playerService.toggleMute());
      }}
      onToggleShuffle={() => {
        void loadPlayerService().then((playerService) => playerService.toggleShuffle());
      }}
      onCycleRepeatMode={() => {
        void loadPlayerService().then((playerService) => playerService.cycleRepeatMode());
      }}
      onShowLyrics={() => {
        if (playerState.currentTrack) {
          onOpenNowPlaying("details");
        }
      }}
      onToggleFavorite={() => {
        if (playerState.currentTrack) {
          void loadFavoritesService().then((favoritesService) =>
            favoritesService.toggle(playerState.currentTrack!.id),
          );
        }
      }}
      onAddToPlaylist={() => {
        if (playerState.currentTrack) {
          onAddToPlaylist(playerState.currentTrack.id);
        }
      }}
      onOpenArtist={(artistName) => {
        if (playerState.currentTrack) {
          onOpenArtist(playerState.currentTrack.id, artistName);
        }
      }}
      onOpenNowPlaying={() => {
        if (playerState.currentTrack) {
          onOpenNowPlaying("cover");
        }
      }}
    />
  );
}

function NowPlayingModalContainer({
  open,
  viewMode,
  onViewModeChange,
  onClose,
  onAddToPlaylist,
  onOpenArtist,
}: {
  open: boolean;
  viewMode: NowPlayingViewMode;
  onViewModeChange: (viewMode: NowPlayingViewMode) => void;
  onClose: () => void;
  onAddToPlaylist: (trackId: string) => void;
  onOpenArtist: (trackId: string, artistName?: string) => void;
}) {
  const playerState = useAppStore(
    useShallow((state) => ({
      currentTrack: state.currentTrackId ? state.tracks[state.currentTrackId] ?? null : null,
      artists: state.artists,
      releases: state.releases,
      lyricsByTrackId: state.lyricsByTrackId,
      isPlaying: state.isPlaying,
      progress: state.progress,
      duration: state.duration,
      playerSettings: state.playerSettings,
    })),
  );

  const currentTrack = playerState.currentTrack;
  const artist = currentTrack?.musicBrainzArtistId
    ? playerState.artists[currentTrack.musicBrainzArtistId]
    : undefined;
  const release = currentTrack?.musicBrainzReleaseId
    ? playerState.releases[currentTrack.musicBrainzReleaseId]
    : undefined;
  const lyrics = currentTrack ? playerState.lyricsByTrackId[currentTrack.id] : undefined;

  useEffect(() => {
    if (!open || !currentTrack) {
      return;
    }

    let cancelled = false;

    void Promise.all([loadMetadataEnrichmentService(), loadLyricsService()]).then(
      ([metadataEnrichmentService, lyricsService]) => {
        if (cancelled) {
          return;
        }

        void metadataEnrichmentService.enrichTrack(currentTrack.id);
        void lyricsService.getLyrics(currentTrack.id);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, open]);

  if (!open || !currentTrack) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <NowPlayingModal
        currentTrack={currentTrack}
        artist={artist}
        release={release}
        lyrics={lyrics}
        viewMode={viewMode}
        isPlaying={playerState.isPlaying}
        progress={playerState.progress}
        duration={playerState.duration}
        volume={playerState.playerSettings.volume}
        muted={playerState.playerSettings.muted}
        repeatMode={playerState.playerSettings.repeatMode}
        shuffleEnabled={playerState.playerSettings.shuffleEnabled}
        onClose={onClose}
        onPlayPause={() => {
          void loadPlayerService().then((playerService) => playerService.togglePlayPause());
        }}
        onNext={() => {
          void loadPlayerService().then((playerService) => playerService.playNext());
        }}
        onPrevious={() => {
          void loadPlayerService().then((playerService) => playerService.playPrevious());
        }}
        onSeek={(value) => {
          void loadPlayerService().then((playerService) => playerService.seek(value));
        }}
        onVolumeChange={(value) => {
          void loadPlayerService().then((playerService) => playerService.setVolume(value));
        }}
        onToggleMute={() => {
          void loadPlayerService().then((playerService) => playerService.toggleMute());
        }}
        onToggleShuffle={() => {
          void loadPlayerService().then((playerService) => playerService.toggleShuffle());
        }}
        onCycleRepeatMode={() => {
          void loadPlayerService().then((playerService) => playerService.cycleRepeatMode());
        }}
        onChangeViewMode={onViewModeChange}
        onToggleFavorite={() => {
          void loadFavoritesService().then((favoritesService) =>
            favoritesService.toggle(currentTrack.id),
          );
        }}
        onAddToPlaylist={() => onAddToPlaylist(currentTrack.id)}
        onOpenArtist={(artistName) => onOpenArtist(currentTrack.id, artistName)}
        onSeekToLyrics={(seconds) => {
          void loadPlayerService().then((playerService) =>
            playerService.seekToTrackPosition(currentTrack.id, seconds, [currentTrack.id]),
          );
        }}
      />
    </Suspense>
  );
}

function TrackDetailsModalContainer({
  onOpenArtist,
  onSeekToLyrics,
}: {
  onOpenArtist: (trackId: string, artistName?: string) => void;
  onSeekToLyrics: (trackId: string, seconds: number) => void;
}) {
  const detailsState = useAppStore(
    useShallow((state) => ({
      detailsTrackId: state.detailsTrackId,
      tracks: state.tracks,
      artists: state.artists,
      releases: state.releases,
      lyricsByTrackId: state.lyricsByTrackId,
      currentTrackId: state.currentTrackId,
      progress: state.progress,
    })),
  );
  const setDetailsTrackId = useAppStore((state) => state.setDetailsTrackId);

  useEffect(() => {
    if (!detailsState.detailsTrackId) {
      return;
    }

    let cancelled = false;

    void Promise.all([loadMetadataEnrichmentService(), loadLyricsService()]).then(
      ([metadataEnrichmentService, lyricsService]) => {
        if (cancelled) {
          return;
        }

        void metadataEnrichmentService.enrichTrack(detailsState.detailsTrackId as string);
        void lyricsService.getLyrics(detailsState.detailsTrackId as string);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [detailsState.detailsTrackId]);

  if (!detailsState.detailsTrackId) {
    return null;
  }

  const track = detailsState.tracks[detailsState.detailsTrackId];

  if (!track) {
    return null;
  }

  const artist = track.musicBrainzArtistId
    ? detailsState.artists[track.musicBrainzArtistId]
    : undefined;
  const release = track.musicBrainzReleaseId
    ? detailsState.releases[track.musicBrainzReleaseId]
    : undefined;
  const lyrics = detailsState.lyricsByTrackId[track.id];

  return (
    <Suspense fallback={null}>
      <TrackDetailsModal
        track={track}
        artist={artist}
        release={release}
        lyrics={lyrics}
        currentTrackId={detailsState.currentTrackId}
        currentProgress={detailsState.progress}
        onClose={() => setDetailsTrackId(null)}
        onOpenArtist={(artistName) => onOpenArtist(track.id, artistName)}
        onSeekToLyrics={(seconds) => onSeekToLyrics(track.id, seconds)}
      />
    </Suspense>
  );
}

export default function App() {
  const { route, navigate } = useHashRoute();
  const authState = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      authError: state.authError,
      hasRestoredSession: state.hasRestoredSession,
    })),
  );
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const logout = useAuthStore((state) => state.logout);
  const appState = useAppStore(
    useShallow((state) => ({
      tracks: state.tracks,
      artists: state.artists,
      releases: state.releases,
      artistStatuses: state.artistStatuses,
      artistTrackIdsByArtistId: state.artistTrackIdsByArtistId,
      artistTrackStatuses: state.artistTrackStatuses,
      releaseStatuses: state.releaseStatuses,
      popularTrackIds: state.popularTrackIds,
      searchResultIds: state.searchResultIds,
      searchStatus: state.searchStatus,
      searchError: state.searchError,
      recentSearches: state.recentSearches,
      listenHistory: state.listenHistory,
      favorites: state.favorites,
      playlists: state.playlists,
      currentTrackId: state.currentTrackId,
      isPlaying: state.isPlaying,
    })),
  );
  const addRecentSearch = useAppStore((state) => state.addRecentSearch);
  const cleanupListenHistory = useAppStore((state) => state.cleanupListenHistory);
  const setDetailsTrackId = useAppStore((state) => state.setDetailsTrackId);
  const [searchValue, setSearchValue] = useState(() => useAppStore.getState().searchQuery);
  const [playlistModalTrackId, setPlaylistModalTrackId] = useState<string | null>(null);
  const [isNowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [nowPlayingViewMode, setNowPlayingViewMode] = useState<NowPlayingViewMode>("cover");
  const debouncedSearchValue = useDebouncedValue(searchValue, 350);
  const isAuthRoute = route.page === "login" || route.page === "register";

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    let cancelled = false;
    cleanupListenHistory();

    void Promise.all([loadPlayerService(), loadCacheService(), loadDownloadService()]).then(
      async ([playerService, cacheService, downloadService]) => {
        if (cancelled) {
          return;
        }

        playerService.initialize();
        await downloadService.restoreDownloadsFromDisk();

        if (cancelled) {
          return;
        }

        playerService.hydrateFromStore();
        void cacheService.cleanupExpired();
      },
    );

    return () => {
      cancelled = true;
    };
  }, [cleanupListenHistory]);

  useEffect(() => {
    if (route.page !== "home") {
      return;
    }

    void loadMusicService().then((musicService) => musicService.loadPopularTracks());
  }, [route.page]);

  useEffect(() => {
    if (!appState.currentTrackId) {
      setNowPlayingOpen(false);
      setNowPlayingViewMode("cover");
    }
  }, [appState.currentTrackId]);

  useEffect(() => {
    if (!isAuthRoute) {
      return;
    }

    setNowPlayingOpen(false);
    setPlaylistModalTrackId(null);
    setDetailsTrackId(null);
    setNowPlayingViewMode("cover");
  }, [isAuthRoute, setDetailsTrackId]);

  useEffect(() => {
    if (route.page !== "search") {
      return;
    }

    void loadMusicService().then((musicService) =>
      musicService.searchTracks(debouncedSearchValue),
    );
  }, [debouncedSearchValue, route.page]);

  useEffect(() => {
    if (route.page !== "artist" || !route.artistId) {
      return;
    }

    void loadArtistService().then((artistService) =>
      artistService.getArtistPageData(route.artistId as string).catch(() => undefined),
    );
  }, [route.artistId, route.page]);

  useEffect(() => {
    if (route.page !== "release" || !route.releaseId) {
      return;
    }

    void loadArtistService().then((artistService) =>
      artistService
        .getReleasePageData(route.releaseId as string, route.artistId)
        .catch(() => undefined),
    );
  }, [route.artistId, route.page, route.releaseId]);

  const popularTracks = useMemo(
    () => getTracksByIds(appState.tracks, appState.popularTrackIds),
    [appState.popularTrackIds, appState.tracks],
  );
  const favoriteTracks = useMemo(
    () => getTracksByIds(appState.tracks, appState.favorites),
    [appState.favorites, appState.tracks],
  );
  const listenHistorySections = useMemo(() => {
    const groupedByDay = new Map<string, Track[]>();

    [...appState.listenHistory]
      .sort(sortHistoryByDateDesc)
      .forEach((entry) => {
        const track = appState.tracks[entry.trackId];

        if (!track) {
          return;
        }

        const dayTracks = groupedByDay.get(entry.dayKey);
        if (dayTracks) {
          dayTracks.push(track);
          return;
        }

        groupedByDay.set(entry.dayKey, [track]);
      });

    return Array.from(groupedByDay.entries())
      .map(([dayKey, tracks]) => ({ dayKey, tracks }))
      .filter((section) => section.tracks.length > 0);
  }, [appState.listenHistory, appState.tracks]);
  const recentQueries = useMemo(
    () => appState.recentSearches.map((item) => item.query),
    [appState.recentSearches],
  );
  const searchTracks = useMemo(() => {
    if (!searchValue.trim()) {
      return popularTracks;
    }

    return getTracksByIds(appState.tracks, appState.searchResultIds);
  }, [appState.searchResultIds, appState.tracks, popularTracks, searchValue]);

  const selectedPlaylist = route.playlistId
    ? appState.playlists.find((playlist) => playlist.id === route.playlistId)
    : undefined;
  const selectedPlaylistTracks = useMemo(
    () => (selectedPlaylist ? getTracksByIds(appState.tracks, selectedPlaylist.trackIds) : []),
    [appState.tracks, selectedPlaylist],
  );

  const artistTracks = useMemo(() => {
    if (!route.artistId) {
      return [];
    }

    const trackIds = new Set<string>(appState.artistTrackIdsByArtistId[route.artistId] ?? []);

    Object.values(appState.releases)
      .filter((release) => release.artistId === route.artistId)
      .forEach((release) => {
        (release.trackIds ?? []).forEach((trackId) => trackIds.add(trackId));
      });

    Object.values(appState.tracks).forEach((track) => {
      if (track.musicBrainzArtistId === route.artistId) {
        trackIds.add(track.id);
      }
    });

    return Array.from(trackIds)
      .map((trackId) => appState.tracks[trackId])
      .filter((track): track is Track => !!track);
  }, [appState.artistTrackIdsByArtistId, appState.releases, appState.tracks, route.artistId]);

  useEffect(() => {
    if (route.page !== "artist" || !route.artistId) {
      return;
    }

    const artistId = route.artistId;
    const artist = appState.artists[artistId];
    const trackStatus = appState.artistTrackStatuses[artistId] ?? "idle";

    if (!artist?.name || trackStatus === "loading" || trackStatus === "ready") {
      return;
    }

    void loadMusicService()
      .then((musicService) => musicService.preloadArtistTracks(artistId, artist.name))
      .catch(() => undefined);
  }, [appState.artistTrackStatuses, appState.artists, route.artistId, route.page]);

  const artistReleases = useMemo(() => {
    if (!route.artistId) {
      return { albums: [], singles: [] };
    }

    const releases = Object.values(appState.releases)
      .filter((release) => release.artistId === route.artistId)
      .sort((left, right) => {
        const rightDate = right.date ? Date.parse(right.date) : Number.NEGATIVE_INFINITY;
        const leftDate = left.date ? Date.parse(left.date) : Number.NEGATIVE_INFINITY;

        return rightDate - leftDate;
      });

    return {
      albums: releases.filter((release) => release.kind === "album"),
      singles: releases.filter((release) => release.kind === "single"),
    };
  }, [appState.releases, route.artistId]);

  const routeRelease = route.releaseId ? appState.releases[route.releaseId] : undefined;
  const routeReleaseStatus = route.releaseId
    ? appState.releaseStatuses[route.releaseId] ??
      (route.page === "release" ? "loading" : "idle")
    : "idle";
  const releaseTracks = useMemo(() => {
    if (!routeRelease?.trackIds?.length) {
      return [];
    }

    return routeRelease.trackIds
      .map((trackId) => appState.tracks[trackId])
      .filter((track): track is Track => !!track);
  }, [appState.tracks, routeRelease]);

  const routeArtist = route.artistId ? appState.artists[route.artistId] : undefined;
  const releaseArtist = routeRelease?.artistId
    ? appState.artists[routeRelease.artistId]
    : routeArtist;
  const routeArtistStatus = route.artistId
    ? appState.artistStatuses[route.artistId] ?? "idle"
    : "idle";
  const routeArtistTracksStatus = route.artistId
    ? appState.artistTrackStatuses[route.artistId] ?? "idle"
    : "idle";
  const playlistModalTrack = playlistModalTrackId
    ? appState.tracks[playlistModalTrackId] ?? null
    : null;

  const handleOpenArtist = async (trackId: string, preferredArtistName?: string) => {
    const artistService = await loadArtistService();
    const artistId = await artistService.resolveArtistIdForTrack(trackId, preferredArtistName);

    if (!artistId) {
      return;
    }

    navigate({ page: "artist", artistId });
  };

  const pageActions = {
    currentTrackId: appState.currentTrackId,
    isPlaying: appState.isPlaying,
    onPlay: (trackId: string, queueIds: string[]) => {
      if (route.page === "search" && searchValue.trim()) {
        addRecentSearch(searchValue);
      }

      void loadPlayerService().then((playerService) =>
        playerService.playTrack(trackId, queueIds),
      );
    },
    onToggleFavorite: (trackId: string) => {
      void loadFavoritesService().then((favoritesService) =>
        favoritesService.toggle(trackId),
      );
    },
    onAddToPlaylist: (trackId: string) => setPlaylistModalTrackId(trackId),
    onShowLyrics: (trackId: string) => setDetailsTrackId(trackId),
    onOpenArtist: (trackId: string, preferredArtistName?: string) => {
      void handleOpenArtist(trackId, preferredArtistName);
    },
  };

  const handleRouteChange = (page: RouteId) => {
    navigate({ page });
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);

    if (value.trim() && route.page !== "search") {
      navigate({ page: "search" });
    }
  };

  const handleSearchSubmit = () => {
    navigate({ page: "search" });
    void loadMusicService().then((musicService) => musicService.searchTracks(searchValue));
  };

  const handleSelectRecentQuery = (query: string) => {
    setSearchValue(query);
    navigate({ page: "search" });
    void loadMusicService().then((musicService) => musicService.searchTracks(query));
  };

  const handleSearchClear = () => {
    setSearchValue("");

    if (route.page === "search") {
      void loadMusicService().then((musicService) => musicService.searchTracks(""));
    }
  };

  const handleCreatePlaylist = (name: string) => {
    void loadPlaylistService().then((playlistService) => {
      const playlistId = playlistService.createPlaylist(name);

      if (!playlistModalTrackId) {
        return;
      }

      playlistService.addTrackToPlaylist(playlistId, playlistModalTrackId);
      setPlaylistModalTrackId(null);
    });
  };

  const renderPage = () => {
    if (route.page === "login") {
      return (
        <LoginPage
          isLoading={authState.isLoading}
          error={authState.authError}
          onLogin={async (payload) => {
            await login(payload);
            navigate({ page: "home" });
          }}
          onOpenRegister={() => navigate({ page: "register" })}
        />
      );
    }

    if (route.page === "register") {
      return (
        <RegisterPage
          isLoading={authState.isLoading}
          error={authState.authError}
          onRegister={async (payload) => {
            await register(payload);
            navigate({ page: "home" });
          }}
          onOpenLogin={() => navigate({ page: "login" })}
        />
      );
    }

    if (route.page === "favorites") {
      return <FavoritesPage tracks={favoriteTracks} {...pageActions} />;
    }

    if (route.page === "history") {
      return <HistoryPage sections={listenHistorySections} {...pageActions} />;
    }

    if (route.page === "search") {
      return (
        <SearchPage
          tracks={searchTracks}
          query={searchValue}
          status={appState.searchStatus}
          error={appState.searchError}
          recentQueries={recentQueries}
          onSelectRecentQuery={handleSelectRecentQuery}
          {...pageActions}
        />
      );
    }

    if (route.page === "playlists" && route.playlistId) {
      return (
        <PlaylistDetailsPage
          playlist={selectedPlaylist}
          tracks={selectedPlaylistTracks}
          onRemoveFromPlaylist={(trackId) => {
            if (!selectedPlaylist) {
              return;
            }

            void loadPlaylistService().then((playlistService) =>
              playlistService.removeTrackFromPlaylist(selectedPlaylist.id, trackId),
            );
          }}
          onBack={() => navigate({ page: "playlists" })}
          {...pageActions}
        />
      );
    }

    if (route.page === "playlists") {
      return (
        <PlaylistsPage
          playlists={appState.playlists}
          onCreatePlaylist={handleCreatePlaylist}
          onOpenPlaylist={(playlistId) => navigate({ page: "playlists", playlistId })}
          onDeletePlaylist={(playlistId) => {
            void loadPlaylistService().then((playlistService) =>
              playlistService.deletePlaylist(playlistId),
            );
          }}
        />
      );
    }

    if (route.page === "artist") {
      return (
        <ArtistPage
          artist={routeArtist}
          status={routeArtistStatus}
          tracksStatus={routeArtistTracksStatus}
          tracks={artistTracks}
          albums={artistReleases.albums}
          singles={artistReleases.singles}
          onOpenRelease={(releaseId) =>
            navigate({ page: "release", artistId: route.artistId, releaseId })
          }
          onBack={() => navigate({ page: "home" })}
          {...pageActions}
        />
      );
    }

    if (route.page === "release") {
      return (
        <ReleasePage
          release={routeRelease}
          artist={releaseArtist}
          status={routeReleaseStatus}
          tracks={releaseTracks}
          onBack={() =>
            navigate(
              route.artistId ? { page: "artist", artistId: route.artistId } : { page: "home" },
            )
          }
          {...pageActions}
        />
      );
    }

    return <HomePage tracks={popularTracks} {...pageActions} />;
  };

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#1f2937,transparent_28%),linear-gradient(180deg,#06070b,#0b0d11_45%,#090b0f)] text-white">
      <div className="flex h-full">
        <Sidebar
          activePage={route.page}
          onNavigate={handleRouteChange}
          user={authState.user}
          isAuthenticated={authState.isAuthenticated}
          isAuthLoading={authState.isLoading}
          onLogout={() => {
            void logout();
          }}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-white/6 px-5 py-5 sm:px-6">
            <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
              <div className="flex items-center justify-between xl:hidden">
                <BrandMark />
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/55">
                  <Music2 size={14} className="mr-2 inline-block" />
                  Russian UI
                </div>
              </div>
              {!isAuthRoute ? (
                <SearchBar
                  value={searchValue}
                  recentQueries={recentQueries}
                  onChange={handleSearchChange}
                  onSubmit={handleSearchSubmit}
                  onClear={handleSearchClear}
                  onSelectRecentQuery={handleSelectRecentQuery}
                />
              ) : null}
            </div>
          </header>

          <main
            className={`scrollbar-none min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6 ${
              isAuthRoute ? "pb-8" : "pb-40"
            }`}
          >
            <div className="mx-auto w-full max-w-[1500px]">
              <Suspense fallback={<PageLoader />}>{renderPage()}</Suspense>
            </div>
          </main>

          {!isAuthRoute ? (
            <div className="shrink-0">
              <PlayerBarContainer
                onAddToPlaylist={(trackId) => setPlaylistModalTrackId(trackId)}
                onOpenArtist={(trackId, artistName) => {
                  void handleOpenArtist(trackId, artistName);
                }}
                onOpenNowPlaying={(viewMode) => {
                  setNowPlayingViewMode(viewMode);
                  setNowPlayingOpen(true);
                }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {!isAuthRoute ? (
        <>
          <NowPlayingModalContainer
            open={isNowPlayingOpen}
            viewMode={nowPlayingViewMode}
            onViewModeChange={setNowPlayingViewMode}
            onClose={() => {
              setNowPlayingOpen(false);
              setNowPlayingViewMode("cover");
            }}
            onAddToPlaylist={(trackId) => {
              setPlaylistModalTrackId(trackId);
              setNowPlayingOpen(false);
              setNowPlayingViewMode("cover");
            }}
            onOpenArtist={(trackId, artistName) => {
              setNowPlayingOpen(false);
              setNowPlayingViewMode("cover");
              void handleOpenArtist(trackId, artistName);
            }}
          />

          {playlistModalTrack ? (
            <Suspense fallback={null}>
              <AddToPlaylistModal
                track={playlistModalTrack}
                playlists={appState.playlists}
                onClose={() => setPlaylistModalTrackId(null)}
                onAddToPlaylist={(playlistId) => {
                  if (!playlistModalTrackId) {
                    return;
                  }

                  void loadPlaylistService().then((playlistService) => {
                    playlistService.addTrackToPlaylist(playlistId, playlistModalTrackId);
                    setPlaylistModalTrackId(null);
                  });
                }}
                onCreatePlaylist={handleCreatePlaylist}
              />
            </Suspense>
          ) : null}

          <TrackDetailsModalContainer
            onOpenArtist={(trackId, artistName) => {
              void handleOpenArtist(trackId, artistName);
            }}
            onSeekToLyrics={(trackId, seconds) => {
              void loadPlayerService().then((playerService) => {
                playerService.seekToTrackPosition(trackId, seconds, [trackId]);
              });
            }}
          />
        </>
      ) : null}

      <AppVersionBadge />
    </div>
  );
}
