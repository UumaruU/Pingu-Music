import { invoke } from "@tauri-apps/api/core";
import { LocalDownloadEntry } from "../types";

interface DownloadResult {
  localPath: string;
}

interface TrackBlobResult {
  mimeType: string;
  base64Data: string;
}

export interface HitmosTrackDto {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  sourceUrl: string;
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const SECURE_PREFIX = "pingu-music-secure";

export const tauriBridge = {
  isTauriRuntime,

  async getPopularHitmos(): Promise<HitmosTrackDto[]> {
    if (!isTauriRuntime()) {
      return [];
    }

    return invoke<HitmosTrackDto[]>("get_popular_hitmos");
  },

  async searchHitmos(query: string): Promise<HitmosTrackDto[]> {
    if (!isTauriRuntime()) {
      return [];
    }

    return invoke<HitmosTrackDto[]>("search_hitmos", { query });
  },

  async saveTrack(trackId: string, audioUrl: string): Promise<DownloadResult> {
    if (isTauriRuntime()) {
      return invoke<DownloadResult>("save_hitmos_track", { trackId, audioUrl });
    }

    return { localPath: `downloads/${trackId}.mp3` };
  },

  async getTrackBlob(audioUrl: string): Promise<TrackBlobResult> {
    if (isTauriRuntime()) {
      return invoke<TrackBlobResult>("get_hitmos_track_blob", { audioUrl });
    }

    throw new Error("Blob fallback is available only in Tauri runtime");
  },

  async getLocalTrackBlob(localPath: string): Promise<TrackBlobResult> {
    if (isTauriRuntime()) {
      return invoke<TrackBlobResult>("get_local_track_blob", { localPath });
    }

    throw new Error("Local blob playback is available only in Tauri runtime");
  },

  async deleteLocalTrack(localPath: string): Promise<void> {
    if (isTauriRuntime()) {
      await invoke("delete_local_track", { localPath });
    }
  },

  async listLocalDownloads(): Promise<LocalDownloadEntry[]> {
    if (isTauriRuntime()) {
      return invoke<LocalDownloadEntry[]>("list_local_downloads");
    }

    return [];
  },

  async saveSecureValue(key: string, value: string): Promise<void> {
    if (!value) {
      await this.deleteSecureValue(key);
      return;
    }

    if (isTauriRuntime()) {
      await invoke("save_secure_value", { key, value });
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${SECURE_PREFIX}:${key}`, value);
    }
  },

  async readSecureValue(key: string): Promise<string | null> {
    if (isTauriRuntime()) {
      return invoke<string | null>("read_secure_value", { key });
    }

    if (typeof window === "undefined") {
      return null;
    }

    return window.localStorage.getItem(`${SECURE_PREFIX}:${key}`);
  },

  async deleteSecureValue(key: string): Promise<void> {
    if (isTauriRuntime()) {
      await invoke("delete_secure_value", { key });
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(`${SECURE_PREFIX}:${key}`);
    }
  },
};
