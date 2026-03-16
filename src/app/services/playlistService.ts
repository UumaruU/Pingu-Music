import { recommendationFacade } from "../integrations/recommendation/recommendationFacade";
import { useAppStore } from "../store/appStore";

export const playlistService = {
  createPlaylist(name: string) {
    return useAppStore.getState().createPlaylist(name);
  },

  deletePlaylist(playlistId: string) {
    useAppStore.getState().deletePlaylist(playlistId);
  },

  addTrackToPlaylist(playlistId: string, trackId: string) {
    useAppStore.getState().addTrackToPlaylist(playlistId, trackId);
    void recommendationFacade.updatePlaylistAffinityForVariantTrack(trackId, playlistId, true);
  },

  removeTrackFromPlaylist(playlistId: string, trackId: string) {
    useAppStore.getState().removeTrackFromPlaylist(playlistId, trackId);
    void recommendationFacade.updatePlaylistAffinityForVariantTrack(trackId, playlistId, false);
  },
};
