import { useEffect, useMemo, useState } from "react";
import { Music2 } from "lucide-react";
import { AddToPlaylistModal } from "./components/AddToPlaylistModal";
import { BrandMark } from "./components/BrandMark";
import { LyricsModal } from "./components/LyricsModal";
import { PlayerBar } from "./components/PlayerBar";
import { SearchBar } from "./components/SearchBar";
import { Sidebar } from "./components/Sidebar";
import { FavoritesPage } from "./pages/FavoritesPage";
import { HomePage } from "./pages/HomePage";
import { PlaylistDetailsPage } from "./pages/PlaylistDetailsPage";
import { PlaylistsPage } from "./pages/PlaylistsPage";
import { SearchPage } from "./pages/SearchPage";
import { favoritesService } from "./services/favoritesService";
import { musicService } from "./services/musicService";
import { playerService } from "./services/playerService";
import { playlistService } from "./services/playlistService";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { useHashRoute } from "./hooks/useHashRoute";
import { useAppStore } from "./store/appStore";
import { RouteId, Track } from "./types";

function getTracksByIds(tracks: Record<string, Track>, ids: string[]) {
  return ids.map((id) => tracks[id]).filter(Boolean);
}

export default function App() {
  const { route, navigate } = useHashRoute();
  const state = useAppStore();
  const [searchValue, setSearchValue] = useState(state.searchQuery);
  const [playlistModalTrackId, setPlaylistModalTrackId] = useState<string | null>(null);
  const debouncedSearchValue = useDebouncedValue(searchValue, 350);

  useEffect(() => {
    playerService.initialize();
    playerService.hydrateFromStore();
    void musicService.loadPopularTracks();
  }, []);

  useEffect(() => {
    if (route.page !== "search") {
      return;
    }

    void musicService.searchTracks(debouncedSearchValue);
  }, [debouncedSearchValue, route.page]);

  const popularTracks = useMemo(() => getTracksByIds(state.tracks, state.popularTrackIds), [state.popularTrackIds, state.tracks]);
  const favoriteTracks = useMemo(() => getTracksByIds(state.tracks, state.favorites), [state.favorites, state.tracks]);
  const searchTracks = useMemo(() => {
    if (!searchValue.trim()) {
      return popularTracks;
    }

    return getTracksByIds(state.tracks, state.searchResultIds);
  }, [popularTracks, searchValue, state.searchResultIds, state.tracks]);

  const selectedPlaylist = route.playlistId
    ? state.playlists.find((playlist) => playlist.id === route.playlistId)
    : undefined;

  const selectedPlaylistTracks = useMemo(
    () => (selectedPlaylist ? getTracksByIds(state.tracks, selectedPlaylist.trackIds) : []),
    [selectedPlaylist, state.tracks],
  );

  const currentTrack = state.currentTrackId ? state.tracks[state.currentTrackId] : null;
  const lyricsTrack = state.lyricsTrackId ? state.tracks[state.lyricsTrackId] : null;
  const playlistModalTrack = playlistModalTrackId ? state.tracks[playlistModalTrackId] : null;

  const pageActions = {
    currentTrackId: state.currentTrackId,
    isPlaying: state.isPlaying,
    onPlay: (trackId: string, queueIds: string[]) => {
      if (route.page === "search" && state.searchQuery.trim()) {
        state.addRecentSearch(state.searchQuery);
      }
      playerService.playTrack(trackId, queueIds);
    },
    onToggleFavorite: (trackId: string) => {
      void favoritesService.toggle(trackId);
    },
    onAddToPlaylist: (trackId: string) => setPlaylistModalTrackId(trackId),
    onShowLyrics: (trackId: string) => state.setLyricsTrackId(trackId),
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
    void musicService.searchTracks(searchValue);
  };

  const handleSelectRecentQuery = (query: string) => {
    setSearchValue(query);
    navigate({ page: "search" });
    void musicService.searchTracks(query);
  };

  const handleSearchClear = () => {
    setSearchValue("");

    if (route.page === "search") {
      void musicService.searchTracks("");
    }
  };

  const handleCreatePlaylist = (name: string) => {
    const playlistId = playlistService.createPlaylist(name);

    if (playlistModalTrackId) {
      playlistService.addTrackToPlaylist(playlistId, playlistModalTrackId);
      setPlaylistModalTrackId(null);
    }
  };

  const renderPage = () => {
    if (route.page === "favorites") {
      return <FavoritesPage tracks={favoriteTracks} {...pageActions} />;
    }

    if (route.page === "search") {
      return (
        <SearchPage
          tracks={searchTracks}
          query={searchValue}
          status={state.searchStatus}
          error={state.searchError}
          recentQueries={state.recentSearches.map((item) => item.query)}
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
            playlistService.removeTrackFromPlaylist(selectedPlaylist.id, trackId);
          }}
          onBack={() => navigate({ page: "playlists" })}
          {...pageActions}
        />
      );
    }

    if (route.page === "playlists") {
      return (
        <PlaylistsPage
          playlists={state.playlists}
          onCreatePlaylist={handleCreatePlaylist}
          onOpenPlaylist={(playlistId) => navigate({ page: "playlists", playlistId })}
          onDeletePlaylist={(playlistId) => playlistService.deletePlaylist(playlistId)}
        />
      );
    }

    return <HomePage tracks={popularTracks} {...pageActions} />;
  };

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#1f2937,transparent_28%),linear-gradient(180deg,#06070b,#0b0d11_45%,#090b0f)] text-white">
      <div className="flex h-full">
        <Sidebar activePage={route.page} onNavigate={handleRouteChange} />

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
              <SearchBar
                value={searchValue}
                recentQueries={state.recentSearches.map((item) => item.query)}
                onChange={handleSearchChange}
                onSubmit={handleSearchSubmit}
                onClear={handleSearchClear}
                onSelectRecentQuery={handleSelectRecentQuery}
              />
            </div>
          </header>

          <main className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-5 py-6 pb-40 sm:px-6">
            <div className="mx-auto w-full max-w-[1500px]">{renderPage()}</div>
          </main>

          <div className="shrink-0">
            <PlayerBar
              currentTrack={currentTrack}
              isPlaying={state.isPlaying}
              progress={state.progress}
              duration={state.duration}
              volume={state.playerSettings.volume}
              muted={state.playerSettings.muted}
              repeatMode={state.playerSettings.repeatMode}
              shuffleEnabled={state.playerSettings.shuffleEnabled}
              onPlayPause={() => playerService.togglePlayPause()}
              onNext={() => playerService.playNext()}
              onPrevious={() => playerService.playPrevious()}
              onSeek={(value) => playerService.seek(value)}
              onVolumeChange={(value) => playerService.setVolume(value)}
              onToggleMute={() => playerService.toggleMute()}
              onToggleShuffle={() => playerService.toggleShuffle()}
              onCycleRepeatMode={() => playerService.cycleRepeatMode()}
              onShowLyrics={() => currentTrack && state.setLyricsTrackId(currentTrack.id)}
              onToggleFavorite={() => currentTrack && void favoritesService.toggle(currentTrack.id)}
              onAddToPlaylist={() => currentTrack && setPlaylistModalTrackId(currentTrack.id)}
            />
          </div>
        </div>
      </div>

      <AddToPlaylistModal
        track={playlistModalTrack}
        playlists={state.playlists}
        onClose={() => setPlaylistModalTrackId(null)}
        onAddToPlaylist={(playlistId) => {
          if (!playlistModalTrackId) {
            return;
          }
          playlistService.addTrackToPlaylist(playlistId, playlistModalTrackId);
          setPlaylistModalTrackId(null);
        }}
        onCreatePlaylist={handleCreatePlaylist}
      />

      {lyricsTrack ? <LyricsModal track={lyricsTrack} onClose={() => state.setLyricsTrackId(null)} /> : null}
    </div>
  );
}
