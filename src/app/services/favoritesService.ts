import { useAppStore } from "../store/appStore";
import { downloadService } from "./downloadService";

export const favoritesService = {
  async toggle(trackId: string) {
    const isFavorite = useAppStore.getState().toggleFavorite(trackId);

    if (isFavorite) {
      await downloadService.startDownload(trackId);
    } else {
      await downloadService.removeDownload(trackId);
    }

    return isFavorite;
  },
};
