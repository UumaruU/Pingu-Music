import { useAppStore } from "../store/appStore";
import { downloadService } from "./downloadService";
import { syncService } from "./syncService";

export const favoritesService = {
  async toggle(trackId: string) {
    const isFavorite = useAppStore.getState().toggleFavorite(trackId);
    void syncService.queueFavoritesPush(useAppStore.getState().favorites);

    if (isFavorite) {
      await downloadService.startDownload(trackId);
    } else {
      await downloadService.removeDownload(trackId);
    }

    return isFavorite;
  },
};
