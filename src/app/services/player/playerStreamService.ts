import { streamResolver } from "../../core/streams/streamResolver";
import { Track } from "../../types";
import { downloadService } from "../downloadService";
import { tauriBridge } from "../tauriBridge";

interface PlaybackStateAdapter {
  getTrack(trackId: string): Track | null;
  setPlaybackState(isPlaying: boolean): void;
  setTrackDownloadState(
    trackId: string,
    downloadState: Track["downloadState"],
    localPath?: string,
    downloadError?: string,
  ): void;
}

interface AudioPlayerAdapter {
  playSource(source: string, duration: number, restart: boolean): Promise<void>;
  releaseRuntimeBlobUrl(): void;
  setRuntimeBlobUrl(url: string): void;
}

export interface PreparedTrackSource {
  trackId: string;
  source: string;
  revokeOnRelease: boolean;
}

export class PlayerStreamService {
  constructor(
    private readonly state: PlaybackStateAdapter,
    private readonly audio: AudioPlayerAdapter,
  ) {}

  private isAbsolutePath(path: string) {
    return /^[a-zA-Z]:\\/.test(path) || path.startsWith("/");
  }

  private decodeBase64ToBytes(base64Data: string) {
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  private createBlobUrl(base64Data: string, mimeType: string) {
    const bytes = this.decodeBase64ToBytes(base64Data);
    const blob = new Blob([bytes], { type: mimeType || "audio/mpeg" });
    return URL.createObjectURL(blob);
  }

  private async tryPlayFromBlob(track: Track, restart: boolean) {
    const blobResult = await tauriBridge.getTrackBlob(track);
    const blobUrl = this.createBlobUrl(blobResult.base64Data, blobResult.mimeType);
    this.audio.releaseRuntimeBlobUrl();
    this.audio.setRuntimeBlobUrl(blobUrl);
    await this.audio.playSource(blobUrl, track.duration, restart);
  }

  private async tryPlayFromSource(track: Track, source: string, restart: boolean) {
    if (!source) {
      return false;
    }

    try {
      await this.audio.playSource(source, track.duration, restart);
      return true;
    } catch {
      return false;
    }
  }

  private async tryPlayFromLocalBlob(track: Track, restart: boolean) {
    if (
      !tauriBridge.isTauriRuntime() ||
      track.downloadState !== "downloaded" ||
      !track.localPath ||
      !this.isAbsolutePath(track.localPath)
    ) {
      return false;
    }

    try {
      const blobResult = await tauriBridge.getLocalTrackBlob(track.localPath);
      const blobUrl = this.createBlobUrl(blobResult.base64Data, blobResult.mimeType);
      this.audio.releaseRuntimeBlobUrl();
      this.audio.setRuntimeBlobUrl(blobUrl);
      await this.audio.playSource(blobUrl, track.duration, restart);
      return true;
    } catch {
      return false;
    }
  }

  async prepareTrack(trackId: string): Promise<PreparedTrackSource | null> {
    const track = this.state.getTrack(trackId);

    if (!track) {
      return null;
    }

    if (
      tauriBridge.isTauriRuntime() &&
      track.downloadState === "downloaded" &&
      track.localPath &&
      this.isAbsolutePath(track.localPath)
    ) {
      try {
        const blobResult = await tauriBridge.getLocalTrackBlob(track.localPath);
        return {
          trackId,
          source: this.createBlobUrl(blobResult.base64Data, blobResult.mimeType),
          revokeOnRelease: true,
        };
      } catch {
      }
    }

    const primarySource = track.audioUrl.trim();

    if (!primarySource) {
      return null;
    }

    if (!tauriBridge.isTauriRuntime()) {
      return {
        trackId,
        source: primarySource,
        revokeOnRelease: false,
      };
    }

    try {
      const blobResult = await tauriBridge.getTrackBlob(track);
      return {
        trackId,
        source: this.createBlobUrl(blobResult.base64Data, blobResult.mimeType),
        revokeOnRelease: true,
      };
    } catch {
    }

    try {
      const resolvedSource = await streamResolver.resolve(track);

      if (resolvedSource) {
        return {
          trackId,
          source: resolvedSource,
          revokeOnRelease: false,
        };
      }
    } catch {
    }

    return {
      trackId,
      source: primarySource,
      revokeOnRelease: false,
    };
  }

  private async tryPlayFromResolvedSource(
    track: Track,
    restart: boolean,
    excludedSource?: string,
  ) {
    try {
      const source = await streamResolver.resolve(track);

      if (!source || (excludedSource && source === excludedSource)) {
        return false;
      }

      await this.audio.playSource(source, track.duration, restart);
      return true;
    } catch {
      return false;
    }
  }

  async playTrack(
    trackId: string,
    restart = true,
    preparedSource?: PreparedTrackSource | null,
  ) {
    const track = this.state.getTrack(trackId);

    if (!track) {
      this.state.setPlaybackState(false);
      return false;
    }

    if (preparedSource?.trackId === trackId && preparedSource.source) {
      if (preparedSource.revokeOnRelease) {
        this.audio.releaseRuntimeBlobUrl();
        this.audio.setRuntimeBlobUrl(preparedSource.source);
      }

      if (await this.tryPlayFromSource(track, preparedSource.source, restart)) {
        return true;
      }
    }

    const prefersLocal =
      tauriBridge.isTauriRuntime() &&
      track.downloadState === "downloaded" &&
      !!track.localPath &&
      this.isAbsolutePath(track.localPath);

    if (prefersLocal) {
      const playedLocalBlob = await this.tryPlayFromLocalBlob(track, restart);

      if (playedLocalBlob) {
        return true;
      }

      this.state.setTrackDownloadState(
        trackId,
        "idle",
        undefined,
        "Р›РѕРєР°Р»СЊРЅС‹Р№ С„Р°Р№Р» РЅРµРґРѕСЃС‚СѓРїРµРЅ",
      );
      const repairedPath = await downloadService.startDownload(trackId);

      if (repairedPath) {
        this.state.setTrackDownloadState(trackId, "downloaded", repairedPath);
        const repairedTrack = this.state.getTrack(trackId);

        if (repairedTrack && (await this.tryPlayFromLocalBlob(repairedTrack, restart))) {
          return true;
        }
      }
    }

    const primarySource = track.audioUrl.trim();

    if (await this.tryPlayFromSource(track, primarySource, restart)) {
      return true;
    }

    if (await this.tryPlayFromResolvedSource(track, restart, primarySource)) {
      return true;
    }

    if (!tauriBridge.isTauriRuntime()) {
      this.state.setPlaybackState(false);
      return false;
    }

    try {
      await this.tryPlayFromBlob(track, restart);
      return true;
    } catch {
    }

    if (!track.isFavorite) {
      this.state.setPlaybackState(false);
      return false;
    }

    const localPath = await downloadService.startDownload(trackId);

    if (!localPath) {
      this.state.setPlaybackState(false);
      return false;
    }

    this.state.setTrackDownloadState(trackId, "downloaded", localPath);
    const downloadedTrack = this.state.getTrack(trackId);

    if (downloadedTrack && (await this.tryPlayFromLocalBlob(downloadedTrack, restart))) {
      return true;
    }

    if (!(await this.tryPlayFromResolvedSource(track, restart, primarySource))) {
      console.error("[player] Failed to play track after all fallbacks", {
        trackId,
        providerId: track.providerId,
      });
      this.state.setPlaybackState(false);
      return false;
    }

    return true;
  }
}