import { useAppStore } from "../store/appStore";
import { clamp } from "../utils/format";
import { shuffleArray } from "../utils/shuffle";
import { downloadService } from "./downloadService";
import { tauriBridge } from "./tauriBridge";

class PlayerService {
  private audio = new Audio();

  private initialized = false;
  private runtimeBlobUrl: string | null = null;
  private historyTrackId: string | null = null;
  private historySavedForCurrentTrack = false;
  private pendingSeekSeconds: number | null = null;

  initialize() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    const state = useAppStore.getState();
    this.audio.volume = state.playerSettings.volume;
    this.audio.muted = state.playerSettings.muted;

    this.audio.addEventListener("timeupdate", () => {
      useAppStore.getState().setProgress(this.audio.currentTime);
      this.trySaveListenHistory();
    });

    this.audio.addEventListener("loadedmetadata", () => {
      if (this.pendingSeekSeconds !== null) {
        this.audio.currentTime = clamp(this.pendingSeekSeconds, 0, this.audio.duration || this.pendingSeekSeconds);
        this.pendingSeekSeconds = null;
      }

      useAppStore.getState().setDuration(Number.isFinite(this.audio.duration) ? this.audio.duration : 0);
    });

    this.audio.addEventListener("ended", () => {
      this.trySaveListenHistory(true);
      this.handleEnded();
    });

    this.audio.addEventListener("error", () => {
      this.getState().setPlaybackState(false);
    });
  }

  private getState() {
    return useAppStore.getState();
  }

  private getCurrentTrack() {
    const state = this.getState();
    return state.currentTrackId ? state.tracks[state.currentTrackId] : null;
  }

  private syncHistoryTrackingTrack(trackId: string) {
    if (this.historyTrackId === trackId) {
      return;
    }

    this.historyTrackId = trackId;
    this.historySavedForCurrentTrack = false;
  }

  private trySaveListenHistory(force = false) {
    const currentTrack = this.getCurrentTrack();

    if (!currentTrack) {
      return;
    }

    this.syncHistoryTrackingTrack(currentTrack.id);

    if (this.historySavedForCurrentTrack) {
      return;
    }

    const duration = Number.isFinite(this.audio.duration) && this.audio.duration > 0
      ? this.audio.duration
      : currentTrack.duration;

    if (!Number.isFinite(duration) || duration <= 0) {
      return;
    }

    const progressRatio = duration > 0 ? this.audio.currentTime / duration : 0;

    if (force || progressRatio >= 0.5) {
      this.getState().addListenHistory(currentTrack.id);
      this.historySavedForCurrentTrack = true;
    }
  }

  private isAbsolutePath(path: string) {
    return /^[a-zA-Z]:\\/.test(path) || path.startsWith("/");
  }

  private getTrackSources(trackId: string) {
    const track = this.getState().tracks[trackId];

    if (!track) {
      return [];
    }

    const sources: string[] = [];

    if (track.audioUrl.trim()) {
      sources.push(track.audioUrl.trim());
    }

    return [...new Set(sources)];
  }

  private async playSource(source: string, duration: number, restart: boolean) {
    if (!source) {
      throw new Error("Empty audio source");
    }

    if (this.audio.src !== source) {
      this.audio.src = source;
      this.audio.load();
      if (restart) {
        this.audio.currentTime = 0;
      } else {
        const resumeProgress = this.getState().progress;
        if (Number.isFinite(resumeProgress) && resumeProgress > 0) {
          this.audio.currentTime = resumeProgress;
        }
      }
    } else if (restart) {
      this.audio.currentTime = 0;
    }

    await this.audio.play();
    this.getState().setPlaybackState(true);
    this.getState().setDuration(duration);
  }

  private releaseRuntimeBlobUrl() {
    if (!this.runtimeBlobUrl) {
      return;
    }

    URL.revokeObjectURL(this.runtimeBlobUrl);
    this.runtimeBlobUrl = null;
  }

  private decodeBase64ToBytes(base64Data: string) {
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  private async tryPlayFromBlob(trackId: string, restart: boolean) {
    const track = this.getState().tracks[trackId];

    if (!track) {
      return false;
    }

    try {
      const blobResult = await tauriBridge.getTrackBlob(track.audioUrl);
      const bytes = this.decodeBase64ToBytes(blobResult.base64Data);
      const blob = new Blob([bytes], { type: blobResult.mimeType || "audio/mpeg" });
      const blobUrl = URL.createObjectURL(blob);
      this.releaseRuntimeBlobUrl();
      this.runtimeBlobUrl = blobUrl;
      await this.playSource(blobUrl, track.duration, restart);
      return true;
    } catch (error) {
      console.error("[player] Failed to play by runtime blob", { trackId, error });
      return false;
    }
  }

  private async tryPlayFromLocalBlob(trackId: string, restart: boolean) {
    const track = this.getState().tracks[trackId];

    if (!track || !tauriBridge.isTauriRuntime()) {
      return false;
    }

    if (
      track.downloadState !== "downloaded" ||
      !track.localPath ||
      !this.isAbsolutePath(track.localPath)
    ) {
      return false;
    }

    try {
      const blobResult = await tauriBridge.getLocalTrackBlob(track.localPath);
      const bytes = this.decodeBase64ToBytes(blobResult.base64Data);
      const blob = new Blob([bytes], { type: blobResult.mimeType || "audio/mpeg" });
      const blobUrl = URL.createObjectURL(blob);
      this.releaseRuntimeBlobUrl();
      this.runtimeBlobUrl = blobUrl;
      await this.playSource(blobUrl, track.duration, restart);
      return true;
    } catch (error) {
      console.error("[player] Failed to play local blob", {
        trackId,
        localPath: track.localPath,
        error,
      });
      return false;
    }
  }

  private async tryPlayFromSources(trackId: string, sources: string[], restart: boolean) {
    const track = this.getState().tracks[trackId];

    if (!track) {
      return false;
    }

    for (const source of sources) {
      try {
        await this.playSource(source, track.duration, restart);
        return true;
      } catch (error) {
        console.error("[player] Failed to play source", {
          trackId,
          source,
          error,
        });
      }
    }

    return false;
  }

  private async syncAndPlay(trackId: string, restart = true) {
    this.syncHistoryTrackingTrack(trackId);
    const track = this.getState().tracks[trackId];
    const prefersLocal =
      !!track &&
      tauriBridge.isTauriRuntime() &&
      track.downloadState === "downloaded" &&
      !!track.localPath &&
      this.isAbsolutePath(track.localPath);

    if (prefersLocal) {
      const playedLocalBlob = await this.tryPlayFromLocalBlob(trackId, restart);

      if (playedLocalBlob) {
        return;
      }

      // Local file is marked as downloaded but cannot be opened; force fresh download.
      this.getState().setTrackDownloadState(trackId, "idle", undefined, "Локальный файл недоступен");
      const repairedPath = await downloadService.startDownload(trackId);

      if (repairedPath) {
        this.getState().setTrackDownloadState(trackId, "downloaded", repairedPath);
        const playedRepairedLocalBlob = await this.tryPlayFromLocalBlob(trackId, restart);

        if (playedRepairedLocalBlob) {
          return;
        }
      }
    }

    const primarySources = this.getTrackSources(trackId);
    const playedPrimary = await this.tryPlayFromSources(trackId, primarySources, restart);

    if (playedPrimary) {
      return;
    }

    if (!tauriBridge.isTauriRuntime()) {
      this.getState().setPlaybackState(false);
      return;
    }

    const playedFromBlob = await this.tryPlayFromBlob(trackId, restart);

    if (playedFromBlob) {
      return;
    }

    const freshTrack = this.getState().tracks[trackId];
    const canPersistDownload = !!freshTrack?.isFavorite;

    if (!canPersistDownload) {
      this.getState().setPlaybackState(false);
      return;
    }

    const localPath = await downloadService.startDownload(trackId);

    if (!localPath) {
      this.getState().setPlaybackState(false);
      return;
    }

    this.getState().setTrackDownloadState(trackId, "downloaded", localPath);

    const playedFallbackLocalBlob = await this.tryPlayFromLocalBlob(trackId, restart);

    if (playedFallbackLocalBlob) {
      return;
    }

    const playedFallback = await this.tryPlayFromSources(trackId, primarySources, restart);

    if (!playedFallback) {
      this.getState().setPlaybackState(false);
    }
  }

  playTrack(trackId: string, queueIds: string[]) {
    this.initialize();
    const nextQueue = queueIds.length ? queueIds : [trackId];
    this.getState().setQueue(nextQueue, trackId);
    void this.syncAndPlay(trackId, true);
  }

  togglePlayPause() {
    const currentTrack = this.getCurrentTrack();

    if (!currentTrack) {
      return;
    }

    if (this.audio.paused) {
      if (this.audio.src) {
        void this.audio
          .play()
          .then(() => {
            this.getState().setPlaybackState(true);
          })
          .catch(() => {
            void this.syncAndPlay(currentTrack.id, false);
          });
      } else {
        void this.syncAndPlay(currentTrack.id, false);
      }
    } else {
      this.audio.pause();
      this.getState().setPlaybackState(false);
    }
  }

  seek(progress: number) {
    this.audio.currentTime = clamp(progress, 0, this.audio.duration || progress);
    this.getState().setProgress(this.audio.currentTime);
  }

  seekToTrackPosition(trackId: string, progress: number, queueIds?: string[]) {
    const safeProgress = Math.max(0, progress);
    const state = this.getState();

    if (state.currentTrackId === trackId) {
      this.seek(safeProgress);
      return;
    }

    this.pendingSeekSeconds = safeProgress;
    this.playTrack(trackId, queueIds ?? [trackId]);
  }

  setVolume(volume: number) {
    this.audio.volume = volume;
    this.getState().setVolume(volume);
  }

  toggleMute() {
    const nextMuted = !this.audio.muted;
    this.audio.muted = nextMuted;
    this.getState().setMuted(nextMuted);
  }

  private playByIndex(index: number) {
    const state = this.getState();
    const trackId = state.currentQueue[index];

    if (!trackId) {
      return;
    }

    state.setCurrentTrackIndex(index);
    void this.syncAndPlay(trackId, true);
  }

  playNext() {
    const state = this.getState();

    if (!state.currentQueue.length) {
      return;
    }

    const nextIndex = state.currentTrackIndex + 1;

    if (nextIndex < state.currentQueue.length) {
      this.playByIndex(nextIndex);
      return;
    }

    if (state.playerSettings.repeatMode === "all") {
      this.playByIndex(0);
      return;
    }

    state.setPlaybackState(false);
  }

  playPrevious() {
    const state = this.getState();

    if (!state.currentQueue.length) {
      return;
    }

    if (this.audio.currentTime > 3) {
      this.seek(0);
      return;
    }

    const previousIndex = state.currentTrackIndex <= 0 ? state.currentQueue.length - 1 : state.currentTrackIndex - 1;
    this.playByIndex(previousIndex);
  }

  toggleShuffle() {
    const state = this.getState();
    const enabled = !state.playerSettings.shuffleEnabled;
    state.setShuffleEnabled(enabled);

    if (!state.currentTrackId) {
      return;
    }

    if (enabled) {
      const remaining = state.originalQueue.filter((trackId) => trackId !== state.currentTrackId);
      const shuffled = [state.currentTrackId, ...shuffleArray(remaining)];
      state.setQueue(shuffled, state.currentTrackId, state.originalQueue);
    } else {
      state.setQueue(state.originalQueue, state.currentTrackId, state.originalQueue);
    }
  }

  cycleRepeatMode() {
    const current = this.getState().playerSettings.repeatMode;
    const next = current === "off" ? "all" : current === "all" ? "one" : "off";
    this.getState().setRepeatMode(next);
  }

  handleEnded() {
    const state = this.getState();

    if (state.playerSettings.repeatMode === "one" && state.currentTrackId) {
      void this.syncAndPlay(state.currentTrackId, true);
      return;
    }

    const isLastTrack = state.currentTrackIndex >= state.currentQueue.length - 1;

    if (isLastTrack && state.playerSettings.repeatMode === "off") {
      state.setPlaybackState(false);
      return;
    }

    this.playNext();
  }

  hydrateFromStore() {
    this.initialize();
    const state = this.getState();

    if (!state.currentTrackId) {
      return;
    }

    const track = state.tracks[state.currentTrackId];

    if (!track) {
      return;
    }

    const sources = this.getTrackSources(track.id);
    const source = sources[0];

    if (!source) {
      return;
    }

    this.audio.src = source;
    this.audio.currentTime = state.progress;
    this.audio.volume = state.playerSettings.volume;
    this.audio.muted = state.playerSettings.muted;
    state.setDuration(track.duration);
  }
}

export const playerService = new PlayerService();
