"use strict";
// Frontend adapter: ships known track metadata to the backend so server-side recommendations have a playable catalog.
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverTrackCatalogService = void 0;
const apiClient_1 = require("./apiClient");
const authStore_1 = require("../store/authStore");
function buildFingerprint(track) {
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
function serializeTrack(track) {
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
    constructor() {
        Object.defineProperty(this, "fingerprints", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "pending", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "inFlight", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    queueTracks(tracks) {
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
    async syncTracks(tracks) {
        if (!authStore_1.useAuthStore.getState().isAuthenticated) {
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
                await apiClient_1.apiClient.request("/me/tracks/resolve-many", {
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
        }
        finally {
            this.inFlight = null;
        }
    }
    reset() {
        this.pending.clear();
        this.fingerprints.clear();
        this.inFlight = null;
    }
}
exports.serverTrackCatalogService = new ServerTrackCatalogService();
