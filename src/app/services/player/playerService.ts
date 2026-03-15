import { useAppStore } from "../../store/appStore";
import { clamp } from "../../utils/format";
import { shuffleArray } from "../../utils/shuffle";
import { PlayerStreamService, PreparedTrackSource } from "./playerStreamService";

class PlayerService {
  private audio = new Audio();
  private preloadAudio = new Audio();

  private initialized = false;
  private runtimeBlobUrl: string | null = null;
  private historyTrackId: string | null = null;
  private historySavedForCurrentTrack = false;
  private pendingSeekSeconds: number | null = null;
  private preparedTrackSource: PreparedTrackSource | null = null;
  private preloadRequestId = 0;
  private readonly streamService = new PlayerStreamService(
    {
      getTrack: (trackId) => this.getState().tracks[trackId] ?? null,
      setPlaybackState: (isPlaying) => this.getState().setPlaybackState(isPlaying),
      setTrackDownloadState: (trackId, downloadState, localPath, downloadError) =>
        this.getState().setTrackDownloadState(trackId, downloadState, localPath, downloadError),
    },
    {
      playSource: (source, duration, restart) => this.playSource(source, duration, restart),
      releaseRuntimeBlobUrl: () => this.releaseRuntimeBlobUrl(),
      setRuntimeBlobUrl: (url) => {
        this.runtimeBlobUrl = url;
      },
    },
  );

  initialize() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    const state = useAppStore.getState();
    this.preloadAudio.preload = "auto";
    this.audio.volume = state.playerSettings.volume;
    this.audio.muted = state.playerSettings.muted;

    this.audio.addEventListener("timeupdate", () => {
      useAppStore.getState().setProgress(this.audio.currentTime);
      this.trySaveListenHistory();
    });

    this.audio.addEventListener("loadedmetadata", () => {
      if (this.pendingSeekSeconds !== null) {
        this.audio.currentTime = clamp(
          this.pendingSeekSeconds,
          0,
          this.audio.duration || this.pendingSeekSeconds,
        );
        this.pendingSeekSeconds = null;
      }

      useAppStore
        .getState()
        .setDuration(Number.isFinite(this.audio.duration) ? this.audio.duration : 0);
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

    const duration =
      Number.isFinite(this.audio.duration) && this.audio.duration > 0
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

  private releasePreparedTrackSource(preparedTrack: PreparedTrackSource | null = this.preparedTrackSource) {
    if (preparedTrack?.revokeOnRelease) {
      URL.revokeObjectURL(preparedTrack.source);
    }

    if (!preparedTrack || this.preparedTrackSource?.trackId === preparedTrack.trackId) {
      this.preparedTrackSource = null;
    }
  }

  private consumePreparedTrackSource(trackId: string) {
    if (!this.preparedTrackSource || this.preparedTrackSource.trackId !== trackId) {
      return null;
    }

    const preparedTrack = this.preparedTrackSource;
    this.preparedTrackSource = null;
    return preparedTrack;
  }

  private getUpcomingTrackId() {
    const state = this.getState();

    if (!state.currentQueue.length || state.currentTrackIndex < 0) {
      return null;
    }

    if (state.playerSettings.repeatMode === "one") {
      return state.currentTrackId;
    }

    const nextIndex = state.currentTrackIndex + 1;

    if (nextIndex < state.currentQueue.length) {
      return state.currentQueue[nextIndex] ?? null;
    }

    if (state.playerSettings.repeatMode === "all") {
      return state.currentQueue[0] ?? null;
    }

    return null;
  }

  private async preloadUpcomingTrack(currentTrackId: string) {
    const nextTrackId = this.getUpcomingTrackId();

    if (!nextTrackId || nextTrackId === currentTrackId) {
      this.releasePreparedTrackSource();
      this.preloadAudio.removeAttribute("src");
      this.preloadAudio.load();
      return;
    }

    if (this.preparedTrackSource?.trackId === nextTrackId) {
      return;
    }

    this.releasePreparedTrackSource();
    const requestId = ++this.preloadRequestId;
    const preparedTrack = await this.streamService.prepareTrack(nextTrackId);

    if (requestId !== this.preloadRequestId) {
      this.releasePreparedTrackSource(preparedTrack);
      return;
    }

    if (!preparedTrack) {
      return;
    }

    this.preparedTrackSource = preparedTrack;
    this.preloadAudio.src = preparedTrack.source;
    this.preloadAudio.load();
  }

  private async syncAndPlay(trackId: string, restart = true) {
    this.syncHistoryTrackingTrack(trackId);
    const preparedTrack = this.consumePreparedTrackSource(trackId);
    const played = await this.streamService.playTrack(trackId, restart, preparedTrack);

    if (!played) {
      this.releasePreparedTrackSource(preparedTrack);
      return;
    }

    if (this.getState().currentTrackId === trackId) {
      void this.preloadUpcomingTrack(trackId);
    }
  }

  playTrack(trackId: string, queueIds: string[]) {
    this.initialize();
    const nextQueue = queueIds.length ? queueIds : [trackId];
    this.preloadRequestId += 1;
    this.releasePreparedTrackSource();
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

    const previousIndex =
      state.currentTrackIndex <= 0 ? state.currentQueue.length - 1 : state.currentTrackIndex - 1;
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

    if (!track || !track.audioUrl) {
      return;
    }

    this.audio.src = track.audioUrl;
    this.audio.currentTime = state.progress;
    this.audio.volume = state.playerSettings.volume;
    this.audio.muted = state.playerSettings.muted;
    state.setDuration(track.duration);
    void this.preloadUpcomingTrack(track.id);
  }
}

export const playerService = new PlayerService();
