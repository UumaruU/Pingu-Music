import { invoke } from "@tauri-apps/api/core";
import type { LocalDownloadEntry, Track } from "../types";

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

export interface SoundcloudTrackDto {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  sourceUrl: string;
}

export interface LmusicTrackDto {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  sourceUrl: string;
}

export interface LmusicArtistDto {
  name: string;
  slug: string;
  tags: string[];
  imageUrl?: string;
  description?: string;
  sourceUrl: string;
}

type BridgeTrackRef = Pick<
  Track,
  "id" | "providerId" | "title" | "artist" | "audioUrl" | "sourceUrl"
>;

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

  async searchSoundcloud(query: string): Promise<SoundcloudTrackDto[]> {
    if (!isTauriRuntime()) {
      return [];
    }

    return invoke<SoundcloudTrackDto[]>("search_soundcloud", { query });
  },

  async searchLmusic(query: string): Promise<LmusicTrackDto[]> {
    if (!isTauriRuntime()) {
      return [];
    }

    return invoke<LmusicTrackDto[]>("search_lmusic", { query });
  },

  async getLmusicArtistMetadata(artistName: string): Promise<LmusicArtistDto | null> {
    if (!isTauriRuntime()) {
      return null;
    }

    return invoke<LmusicArtistDto | null>("get_lmusic_artist_metadata", {
      artistName,
    });
  },

  async resolveSoundcloudStream(sourceUrl: string): Promise<string> {
    if (!isTauriRuntime()) {
      return sourceUrl;
    }

    return invoke<string>("resolve_soundcloud_stream", { sourceUrl });
  },

  async resolveCoverArtUrl(releaseId: string): Promise<string | null> {
    if (!isTauriRuntime()) {
      return null;
    }

    return invoke<string | null>("resolve_cover_art_url", { releaseId });
  },

  async saveTrack(track: BridgeTrackRef): Promise<DownloadResult> {
    if (isTauriRuntime()) {
      if (track.providerId === "soundcloud") {
        return invoke<DownloadResult>("save_soundcloud_track", {
          trackId: track.id,
          sourceUrl: track.sourceUrl || track.audioUrl,
          title: track.title,
          artist: track.artist,
        });
      }

      if (track.providerId === "lmusic") {
        return invoke<DownloadResult>("save_lmusic_track", {
          trackId: track.id,
          audioUrl: track.audioUrl,
        });
      }

      return invoke<DownloadResult>("save_hitmos_track", {
        trackId: track.id,
        audioUrl: track.audioUrl,
      });
    }

    return { localPath: `downloads/${track.id}.mp3` };
  },

  async getTrackBlob(track: BridgeTrackRef): Promise<TrackBlobResult> {
    if (isTauriRuntime()) {
      if (track.providerId === "soundcloud") {
        throw new Error("Blob playback is not available for SoundCloud tracks");
      }

      if (track.providerId === "lmusic") {
        return invoke<TrackBlobResult>("get_lmusic_track_blob", { audioUrl: track.audioUrl });
      }

      return invoke<TrackBlobResult>("get_hitmos_track_blob", { audioUrl: track.audioUrl });
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
