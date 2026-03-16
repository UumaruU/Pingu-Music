"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PROVIDER_ID = void 0;
exports.withTrackProviderDefaults = withTrackProviderDefaults;
exports.normalizeTracks = normalizeTracks;
exports.getProviderTrackId = getProviderTrackId;
const coverUrlService_1 = require("../../services/coverUrlService");
const normalizationService_1 = require("../../services/normalizationService");
const sourceMetadataService_1 = require("../../services/sourceMetadataService");
exports.DEFAULT_PROVIDER_ID = "hitmos";
function withTrackProviderDefaults(track) {
    const normalizedPresentation = normalizationService_1.normalizationService.normalizeTrackPresentation(track.title, track.artist);
    return (0, sourceMetadataService_1.withSourceMetadata)({
        ...track,
        providerId: track.providerId ?? exports.DEFAULT_PROVIDER_ID,
        providerTrackId: track.providerTrackId ?? track.id,
        title: normalizedPresentation.title || track.title,
        artist: normalizedPresentation.artist || track.artist,
        coverUrl: (0, coverUrlService_1.normalizeCoverUrl)(track.coverUrl) || track.coverUrl,
    });
}
function normalizeTracks(tracks) {
    return tracks.map((track) => withTrackProviderDefaults(track));
}
function getProviderTrackId(track) {
    return track.providerTrackId ?? track.id;
}
