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
  },

  removeTrackFromPlaylist(playlistId: string, trackId: string) {
    useAppStore.getState().removeTrackFromPlaylist(playlistId, trackId);
  },
};
