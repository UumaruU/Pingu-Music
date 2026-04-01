export function buildWaveQueueIds(currentTrackId: string | null, nextTrackId: string | null) {
  if (!nextTrackId) {
    return [] as string[];
  }

  if (!currentTrackId) {
    return [nextTrackId];
  }

  if (currentTrackId === nextTrackId) {
    return [currentTrackId];
  }

  return [currentTrackId, nextTrackId];
}

export type StreamWavePlaybackAction =
  | {
      type: "unavailable";
      queueIds: string[];
    }
  | {
      type: "sync-queue";
      queueIds: string[];
    }
  | {
      type: "play-current";
      queueIds: string[];
      startTrackId: string;
    }
  | {
      type: "play-next";
      queueIds: string[];
      startTrackId: string;
    };

export function resolveStreamWavePlaybackAction(params: {
  currentTrackId: string | null;
  nextTrackId: string | null;
  isPlaying: boolean;
}): StreamWavePlaybackAction {
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
