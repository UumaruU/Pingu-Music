"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalizationConfig = exports.CANONICALIZATION_VERSION = void 0;
exports.CANONICALIZATION_VERSION = 1;
exports.canonicalizationConfig = {
    strictMergeThreshold: 5.5,
    relaxedMergeThreshold: 4.5,
    maxDurationDeltaMsStrict: 4000,
    maxDurationDeltaMsRelaxed: 7000,
    titleExactBoost: 2.5,
    artistExactBoost: 2,
    mbRecordingMatchBoost: 12,
    acoustIdMatchBoost: 10,
    titleFlavorConflictPenalty: 6,
    artistMismatchPenalty: 2.5,
    durationMismatchPenalty: 2,
    blockOnFlavorConflict: true,
    blockOnConflictingMbRecordingIds: true,
    blockOnPrimaryArtistConflict: true,
    enableTrackCanonicalization: true,
    enableAggressiveDedup: false,
    enableFingerprintFallback: false,
    lyricsDurationBucketMs: 2000,
    minCanonicalConfidenceForLyricsReuse: 0.7,
    sourcePriorityByProvider: {
        hitmos: 3,
        lmusic: 4,
        soundcloud: 2,
        telegram: 1,
    },
    sourceTrustByProvider: {
        hitmos: 0.9,
        lmusic: 0.92,
        soundcloud: 0.7,
        telegram: 0.45,
    },
};
