"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tauriBridge = void 0;
const core_1 = require("@tauri-apps/api/core");
function isTauriRuntime() {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
const SECURE_PREFIX = "pingu-music-secure";
exports.tauriBridge = {
    isTauriRuntime,
    async getPopularHitmos() {
        if (!isTauriRuntime()) {
            return [];
        }
        return (0, core_1.invoke)("get_popular_hitmos");
    },
    async searchHitmos(query) {
        if (!isTauriRuntime()) {
            return [];
        }
        return (0, core_1.invoke)("search_hitmos", { query });
    },
    async searchSoundcloud(query) {
        if (!isTauriRuntime()) {
            return [];
        }
        return (0, core_1.invoke)("search_soundcloud", { query });
    },
    async searchLmusic(query) {
        if (!isTauriRuntime()) {
            return [];
        }
        return (0, core_1.invoke)("search_lmusic", { query });
    },
    async getLmusicArtistMetadata(artistName) {
        if (!isTauriRuntime()) {
            return null;
        }
        return (0, core_1.invoke)("get_lmusic_artist_metadata", {
            artistName,
        });
    },
    async resolveSoundcloudStream(sourceUrl) {
        if (!isTauriRuntime()) {
            return sourceUrl;
        }
        return (0, core_1.invoke)("resolve_soundcloud_stream", { sourceUrl });
    },
    async resolveCoverArtUrl(releaseId) {
        if (!isTauriRuntime()) {
            return null;
        }
        return (0, core_1.invoke)("resolve_cover_art_url", { releaseId });
    },
    async saveTrack(track) {
        if (isTauriRuntime()) {
            if (track.providerId === "soundcloud") {
                return (0, core_1.invoke)("save_soundcloud_track", {
                    trackId: track.id,
                    sourceUrl: track.sourceUrl || track.audioUrl,
                    title: track.title,
                    artist: track.artist,
                });
            }
            if (track.providerId === "lmusic") {
                return (0, core_1.invoke)("save_lmusic_track", {
                    trackId: track.id,
                    audioUrl: track.audioUrl,
                });
            }
            return (0, core_1.invoke)("save_hitmos_track", {
                trackId: track.id,
                audioUrl: track.audioUrl,
            });
        }
        return { localPath: `downloads/${track.id}.mp3` };
    },
    async getTrackBlob(track) {
        if (isTauriRuntime()) {
            if (track.providerId === "soundcloud") {
                throw new Error("Blob playback is not available for SoundCloud tracks");
            }
            if (track.providerId === "lmusic") {
                return (0, core_1.invoke)("get_lmusic_track_blob", { audioUrl: track.audioUrl });
            }
            return (0, core_1.invoke)("get_hitmos_track_blob", { audioUrl: track.audioUrl });
        }
        throw new Error("Blob fallback is available only in Tauri runtime");
    },
    async getLocalTrackBlob(localPath) {
        if (isTauriRuntime()) {
            return (0, core_1.invoke)("get_local_track_blob", { localPath });
        }
        throw new Error("Local blob playback is available only in Tauri runtime");
    },
    async deleteLocalTrack(localPath) {
        if (isTauriRuntime()) {
            await (0, core_1.invoke)("delete_local_track", { localPath });
        }
    },
    async listLocalDownloads() {
        if (isTauriRuntime()) {
            return (0, core_1.invoke)("list_local_downloads");
        }
        return [];
    },
    async saveSecureValue(key, value) {
        if (!value) {
            await this.deleteSecureValue(key);
            return;
        }
        if (isTauriRuntime()) {
            await (0, core_1.invoke)("save_secure_value", { key, value });
            return;
        }
        if (typeof window !== "undefined") {
            window.localStorage.setItem(`${SECURE_PREFIX}:${key}`, value);
        }
    },
    async readSecureValue(key) {
        if (isTauriRuntime()) {
            return (0, core_1.invoke)("read_secure_value", { key });
        }
        if (typeof window === "undefined") {
            return null;
        }
        return window.localStorage.getItem(`${SECURE_PREFIX}:${key}`);
    },
    async deleteSecureValue(key) {
        if (isTauriRuntime()) {
            await (0, core_1.invoke)("delete_secure_value", { key });
            return;
        }
        if (typeof window !== "undefined") {
            window.localStorage.removeItem(`${SECURE_PREFIX}:${key}`);
        }
    },
};
