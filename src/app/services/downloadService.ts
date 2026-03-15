import { useAppStore } from "../store/appStore";
import { tauriBridge } from "./tauriBridge";

class DownloadService {
  private activeDownloads = new Map<string, Promise<string | null>>();

  private isAbsolutePath(path: string) {
    return /^[a-zA-Z]:\\/.test(path) || path.startsWith("/");
  }

  private async deleteLocalFile(localPath: string) {
    if (!this.isAbsolutePath(localPath)) {
      return;
    }

    await tauriBridge.deleteLocalTrack(localPath);
  }

  async startDownload(trackId: string) {
    const store = useAppStore.getState();
    const track = store.tracks[trackId] ?? store.downloadedTracks[trackId];

    if (!track) {
      return null;
    }

    if (
      track.downloadState === "downloaded" &&
      track.localPath &&
      this.isAbsolutePath(track.localPath)
    ) {
      return track.localPath;
    }

    const activeDownload = this.activeDownloads.get(trackId);

    if (activeDownload) {
      return activeDownload;
    }

    const downloadPromise = (async () => {
      useAppStore.getState().setTrackDownloadState(trackId, "downloading");

      try {
        const result = await tauriBridge.saveTrack(track);
        const freshTrack = useAppStore.getState().tracks[trackId];
        const isStillFavorite = !!freshTrack?.isFavorite;

        if (!isStillFavorite) {
          await this.deleteLocalFile(result.localPath);
          useAppStore.getState().setTrackDownloadState(trackId, "idle", undefined, undefined);
          console.info("[download] Track removed after unfavorite", {
            trackId,
            localPath: result.localPath,
          });
          return null;
        }

        useAppStore.getState().setTrackDownloadState(trackId, "downloaded", result.localPath);
        console.info("[download] Track saved", { trackId, localPath: result.localPath });
        return result.localPath;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Ошибка загрузки";
        console.error("[download] Track download failed", { trackId, error });
        useAppStore.getState().setTrackDownloadState(trackId, "error", undefined, message);
        return null;
      } finally {
        this.activeDownloads.delete(trackId);
      }
    })();

    this.activeDownloads.set(trackId, downloadPromise);
    return downloadPromise;
  }

  async restoreDownloadsFromDisk() {
    if (!tauriBridge.isTauriRuntime()) {
      return;
    }

    try {
      const downloads = await tauriBridge.listLocalDownloads();
      useAppStore.getState().syncDownloadsFromDisk(downloads);
      console.info("[download] Restored local downloads", { count: downloads.length });
    } catch (error) {
      console.error("[download] Failed to restore local downloads", { error });
    }
  }

  async restoreMissingFavoriteDownloads(trackIds: string[]) {
    const favoriteTrackIds = [...new Set(trackIds.filter((trackId) => typeof trackId === "string" && trackId.trim()))];

    if (!favoriteTrackIds.length) {
      return;
    }

    const missingTrackIds = favoriteTrackIds.filter((trackId) => {
      const track = useAppStore.getState().tracks[trackId] ?? useAppStore.getState().downloadedTracks[trackId];

      if (!track || !track.audioUrl.trim()) {
        return false;
      }

      return !(
        track.downloadState === "downloaded" &&
        !!track.localPath &&
        this.isAbsolutePath(track.localPath)
      );
    });

    if (!missingTrackIds.length) {
      return;
    }

    await Promise.allSettled(
      missingTrackIds.map((trackId) => this.startDownload(trackId)),
    );
  }

  async removeDownload(trackId: string) {
    const activeDownload = this.activeDownloads.get(trackId);

    if (activeDownload) {
      await activeDownload.catch(() => null);
    }

    const state = useAppStore.getState();
    const track = state.tracks[trackId] ?? state.downloadedTracks[trackId];

    if (track?.localPath) {
      try {
        await this.deleteLocalFile(track.localPath);
      } catch (error) {
        console.error("[download] Failed to delete local track", { trackId, error });
      }
    }

    useAppStore.getState().setTrackDownloadState(trackId, "idle", undefined, undefined);
  }

  checkIfDownloaded(trackId: string) {
    const state = useAppStore.getState();
    return (state.tracks[trackId] ?? state.downloadedTracks[trackId])?.downloadState === "downloaded";
  }

  getLocalTrackPath(trackId: string) {
    const state = useAppStore.getState();
    return (state.tracks[trackId] ?? state.downloadedTracks[trackId])?.localPath;
  }
}

export const downloadService = new DownloadService();