"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PROVIDER_ID = void 0;
exports.withTrackProviderDefaults = withTrackProviderDefaults;
exports.normalizeTracks = normalizeTracks;
exports.getProviderTrackId = getProviderTrackId;
const coverUrl_1 = require("./coverUrl");
const normalization_1 = require("./normalization");
const sourceMetadata_1 = require("./sourceMetadata");
exports.DEFAULT_PROVIDER_ID = "hitmos";
function withTrackProviderDefaults(track) {
    const normalizedPresentation = (0, normalization_1.normalizeTrackPresentation)(track.title, track.artist);
    return (0, sourceMetadata_1.withSourceMetadata)({
        ...track,
        providerId: track.providerId ?? exports.DEFAULT_PROVIDER_ID,
        providerTrackId: track.providerTrackId ?? track.id,
        title: normalizedPresentation.title || track.title,
        artist: normalizedPresentation.artist || track.artist,
        coverUrl: (0, coverUrl_1.normalizeCoverUrl)(track.coverUrl) || track.coverUrl,
    });
}
function normalizeTracks(tracks) {
    return tracks.map((track) => withTrackProviderDefaults(track));
}
function getProviderTrackId(track) {
    return track.providerTrackId ?? track.id;
}
