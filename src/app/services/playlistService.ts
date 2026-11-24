import { recommendationFacade } from "../integrations/recommendation/recommendationFacade";
import { useAppStore } from "../store/appStore";
import { PlaylistDetailsDraft } from "./playlistDetails";

export const playlistService = {
  createPlaylist(name: string, details?: PlaylistDetailsDraft) {
    return useAppStore.getState().createPlaylist(name, details);
  },

  updatePlaylistDetails(playlistId: string, patch: PlaylistDetailsDraft) {
    useAppStore.getState().updatePlaylistDetails(playlistId, patch);
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
