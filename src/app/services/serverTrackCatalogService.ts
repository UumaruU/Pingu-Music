// Frontend adapter: ships known track metadata to the backend so server-side recommendations have a playable catalog.

import { apiClient } from "./apiClient";
import { Track } from "../types";
import { useAuthStore } from "../store/authStore";

function buildFingerprint(track: Track) {
  return [
    track.id,
    track.providerId,
    track.providerTrackId ?? "",
    track.title,
    track.artist,
    track.albumTitle ?? "",
    track.duration,
    track.audioUrl,
    track.coverUrl,
    track.musicBrainzRecordingId ?? "",
    track.musicBrainzArtistId ?? "",
    track.musicBrainzReleaseId ?? "",
  ].join("|");
}

function serializeTrack(track: Track) {
  return {
    clientTrackId: track.id,
    source: track.providerId,
    sourceTrackId: track.providerTrackId ?? track.id,
    title: track.title,
    artistName: track.artist,
    albumTitle: track.albumTitle ?? null,
    duration: Number.isFinite(track.duration) ? track.duration : null,
    coverUrl: track.coverUrl || null,
    audioUrl: track.audioUrl || null,
    musicBrainzRecordingId: track.musicBrainzRecordingId ?? null,
    musicBrainzArtistId: track.musicBrainzArtistId ?? null,
    musicBrainzReleaseId: track.musicBrainzReleaseId ?? null,
  };
}

class ServerTrackCatalogService {
  private fingerprints = new Map<string, string>();
  private pending = new Map<string, Track>();
  private inFlight: Promise<void> | null = null;

  private queueTracks(tracks: Track[]) {
    tracks.forEach((track) => {
      if (!track?.id || !track.title || !track.artist) {
        return;
      }

      const fingerprint = buildFingerprint(track);
      if (this.fingerprints.get(track.id) === fingerprint) {
        return;
      }

      this.pending.set(track.id, track);
    });
  }

  async syncTracks(tracks: Track[]) {
    if (!useAuthStore.getState().isAuthenticated) {
      return;
    }

    this.queueTracks(tracks);

    if (this.inFlight) {
      await this.inFlight;
      return;
    }

    this.inFlight = (async () => {
      while (this.pending.size > 0) {
        const batch = [...this.pending.values()].slice(0, 100);
        batch.forEach((track) => this.pending.delete(track.id));

        await apiClient.request("/me/tracks/resolve-many", {
          method: "POST",
          body: {
            tracks: batch.map(serializeTrack),
          },
        });

        batch.forEach((track) => {
          this.fingerprints.set(track.id, buildFingerprint(track));
        });
      }
    })();

    try {
      await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  reset() {
    this.pending.clear();
    this.fingerprints.clear();
    this.inFlight = null;
  }
}

export const serverTrackCatalogService = new ServerTrackCatalogService();
