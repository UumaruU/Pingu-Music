"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSourcePriority = getSourcePriority;
exports.getSourceTrustScore = getSourceTrustScore;
exports.withSourceMetadata = withSourceMetadata;
const sourceRegistry_1 = require("../providers/sourceRegistry");
function getSourcePriority(providerId) {
    return (0, sourceRegistry_1.getProviderPriority)(providerId);
}
function getSourceTrustScore(providerId) {
    return (0, sourceRegistry_1.getProviderTrustScore)(providerId);
}
function withSourceMetadata(track) {
    return {
        ...track,
        sourcePriority: track.sourcePriority ?? getSourcePriority(track.providerId),
        sourceTrustScore: track.sourceTrustScore ?? getSourceTrustScore(track.providerId),
    };
}
