"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWaveQueueIds = buildWaveQueueIds;
exports.resolveStreamWavePlaybackAction = resolveStreamWavePlaybackAction;
function buildWaveQueueIds(currentTrackId, nextTrackId) {
    if (!nextTrackId) {
        return [];
    }
    if (!currentTrackId) {
        return [nextTrackId];
    }
    if (currentTrackId === nextTrackId) {
        return [currentTrackId];
    }
    return [currentTrackId, nextTrackId];
}
function resolveStreamWavePlaybackAction(params) {
    const queueIds = buildWaveQueueIds(params.currentTrackId, params.nextTrackId);
    if (!queueIds.length) {
        return {
            type: "unavailable",
            queueIds,
        };
    }
    if (params.currentTrackId) {
        if (params.isPlaying) {
            return {
                type: "sync-queue",
                queueIds,
            };
        }
        return {
            type: "play-current",
            queueIds,
            startTrackId: params.currentTrackId,
        };
    }
    return {
        type: "play-next",
        queueIds,
        startTrackId: queueIds[0],
    };
}
