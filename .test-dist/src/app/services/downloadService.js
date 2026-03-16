"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadService = void 0;
const appStore_1 = require("../store/appStore");
const tauriBridge_1 = require("./tauriBridge");
class DownloadService {
    constructor() {
        Object.defineProperty(this, "activeDownloads", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    isAbsolutePath(path) {
        return /^[a-zA-Z]:\\/.test(path) || path.startsWith("/");
    }
    async deleteLocalFile(localPath) {
        if (!this.isAbsolutePath(localPath)) {
            return;
        }
        await tauriBridge_1.tauriBridge.deleteLocalTrack(localPath);
    }
    async startDownload(trackId) {
        const store = appStore_1.useAppStore.getState();
        const track = store.tracks[trackId] ?? store.downloadedTracks[trackId];
        if (!track) {
            return null;
        }
        if (track.downloadState === "downloaded" &&
            track.localPath &&
            this.isAbsolutePath(track.localPath)) {
            return track.localPath;
        }
        const activeDownload = this.activeDownloads.get(trackId);
        if (activeDownload) {
            return activeDownload;
        }
        const downloadPromise = (async () => {
            appStore_1.useAppStore.getState().setTrackDownloadState(trackId, "downloading");
            try {
                const result = await tauriBridge_1.tauriBridge.saveTrack(track);
                const freshTrack = appStore_1.useAppStore.getState().tracks[trackId];
                const isStillFavorite = !!freshTrack?.isFavorite;
                if (!isStillFavorite) {
                    await this.deleteLocalFile(result.localPath);
                    appStore_1.useAppStore.getState().setTrackDownloadState(trackId, "idle", undefined, undefined);
                    console.info("[download] Track removed after unfavorite", {
                        trackId,
                        localPath: result.localPath,
                    });
                    return null;
                }
                appStore_1.useAppStore.getState().setTrackDownloadState(trackId, "downloaded", result.localPath);
                console.info("[download] Track saved", { trackId, localPath: result.localPath });
                return result.localPath;
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Ошибка загрузки";
                console.error("[download] Track download failed", { trackId, error });
                appStore_1.useAppStore.getState().setTrackDownloadState(trackId, "error", undefined, message);
                return null;
            }
            finally {
                this.activeDownloads.delete(trackId);
            }
        })();
        this.activeDownloads.set(trackId, downloadPromise);
        return downloadPromise;
    }
    async restoreDownloadsFromDisk() {
        if (!tauriBridge_1.tauriBridge.isTauriRuntime()) {
            return;
        }
        try {
            const downloads = await tauriBridge_1.tauriBridge.listLocalDownloads();
            appStore_1.useAppStore.getState().syncDownloadsFromDisk(downloads);
            console.info("[download] Restored local downloads", { count: downloads.length });
        }
        catch (error) {
            console.error("[download] Failed to restore local downloads", { error });
        }
    }
    async restoreMissingFavoriteDownloads(trackIds) {
        const favoriteTrackIds = [...new Set(trackIds.filter((trackId) => typeof trackId === "string" && trackId.trim()))];
        if (!favoriteTrackIds.length) {
            return;
        }
        const missingTrackIds = favoriteTrackIds.filter((trackId) => {
            const track = appStore_1.useAppStore.getState().tracks[trackId] ?? appStore_1.useAppStore.getState().downloadedTracks[trackId];
            if (!track || !track.audioUrl.trim()) {
                return false;
            }
            return !(track.downloadState === "downloaded" &&
                !!track.localPath &&
                this.isAbsolutePath(track.localPath));
        });
        if (!missingTrackIds.length) {
            return;
        }
        await Promise.allSettled(missingTrackIds.map((trackId) => this.startDownload(trackId)));
    }
    async removeDownload(trackId) {
        const activeDownload = this.activeDownloads.get(trackId);
        if (activeDownload) {
            await activeDownload.catch(() => null);
        }
        const state = appStore_1.useAppStore.getState();
        const track = state.tracks[trackId] ?? state.downloadedTracks[trackId];
        if (track?.localPath) {
            try {
                await this.deleteLocalFile(track.localPath);
            }
            catch (error) {
                console.error("[download] Failed to delete local track", { trackId, error });
            }
        }
        appStore_1.useAppStore.getState().setTrackDownloadState(trackId, "idle", undefined, undefined);
    }
    checkIfDownloaded(trackId) {
        const state = appStore_1.useAppStore.getState();
        return (state.tracks[trackId] ?? state.downloadedTracks[trackId])?.downloadState === "downloaded";
    }
    getLocalTrackPath(trackId) {
        const state = appStore_1.useAppStore.getState();
        return (state.tracks[trackId] ?? state.downloadedTracks[trackId])?.localPath;
    }
}
exports.downloadService = new DownloadService();
