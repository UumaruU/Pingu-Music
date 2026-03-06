import { invoke } from "@tauri-apps/api/core";

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
};
