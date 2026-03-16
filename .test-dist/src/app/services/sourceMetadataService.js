"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSourcePriority = getSourcePriority;
exports.getSourceTrustScore = getSourceTrustScore;
exports.withSourceMetadata = withSourceMetadata;
const canonicalizationConfig_1 = require("../config/canonicalizationConfig");
function getSourcePriority(providerId) {
    return canonicalizationConfig_1.canonicalizationConfig.sourcePriorityByProvider[providerId] ?? 0;
}
function getSourceTrustScore(providerId) {
    return canonicalizationConfig_1.canonicalizationConfig.sourceTrustByProvider[providerId] ?? 0;
}
function withSourceMetadata(track) {
    return {
        ...track,
        sourcePriority: track.sourcePriority ?? getSourcePriority(track.providerId),
        sourceTrustScore: track.sourceTrustScore ?? getSourceTrustScore(track.providerId),
    };
}
