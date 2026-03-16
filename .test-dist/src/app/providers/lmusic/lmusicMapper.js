"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapLmusicTracks = mapLmusicTracks;
const trackIdentity_1 = require("../../core/tracks/trackIdentity");
function mapTrack(track) {
    const providerTrackId = track.id.trim();
    return {
        id: `lmusic:${providerTrackId}`,
        providerId: "lmusic",
        providerTrackId,
        title: track.title,
        artist: track.artist,
        coverUrl: track.coverUrl || "https://placehold.co/300x300?text=LMusic",
        audioUrl: track.audioUrl || track.sourceUrl,
        duration: track.duration,
        sourceUrl: track.sourceUrl || "https://lmusic.kz",
        isFavorite: false,
        downloadState: "idle",
        metadataStatus: "raw",
    };
}
function mapLmusicTracks(tracks) {
    return (0, trackIdentity_1.normalizeTracks)(tracks.map(mapTrack));
}
