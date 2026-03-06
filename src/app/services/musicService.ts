import { HitmosProvider } from "../providers/hitmosProvider";
import { useAppStore } from "../store/appStore";

class MusicService {
  private provider = new HitmosProvider();

  async loadPopularTracks() {
    const tracks = await this.provider.getPopularTracks();
    useAppStore.getState().setPopularTracks(tracks);
    return tracks;
  }

  async searchTracks(query: string) {
    const trimmedQuery = query.trim();

    useAppStore
      .getState()
      .setSearchState({ query, trackIds: [], status: "loading", error: null });

    if (!trimmedQuery) {
      await this.loadPopularTracks();
      useAppStore
        .getState()
        .setSearchState({ query: "", trackIds: [], status: "idle", error: null });
      return [];
    }

    try {
      const tracks = await this.provider.searchTracks(trimmedQuery);
      useAppStore.getState().hydrateCatalog(tracks);
      useAppStore.getState().setSearchState({
        query,
        trackIds: tracks.map((track) => track.id),
        status: tracks.length ? "success" : "empty",
        error: null,
      });
      return tracks;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось загрузить данные";
      useAppStore
        .getState()
        .setSearchState({ query, trackIds: [], status: "error", error: message });
      return [];
    }
  }
}

export const musicService = new MusicService();
