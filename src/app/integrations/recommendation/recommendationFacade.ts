// Frontend adapter: recommendations are computed on the authenticated backend; the UI only syncs catalog data and consumes ready-to-play tracks.

import {
  RecommendationChannel,
  RecommendationExplanation,
  RecommendationMode,
} from "../../../recommendation/types";
import { apiClient } from "../../services/apiClient";
import { serverTrackCatalogService } from "../../services/serverTrackCatalogService";
import { useAppStore } from "../../store/appStore";
import { useAuthStore } from "../../store/authStore";
import { Track } from "../../types";

function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `session:${crypto.randomUUID()}`;
  }

  return `session:${Date.now()}`;
}

const currentSessionId = createSessionId();

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export interface FrontendRecommendedTrack {
  canonicalTrackId: string;
  preferredVariantId: string;
  score: number;
  sourceChannels: RecommendationChannel[];
  explanation: RecommendationExplanation;
  track: Track;
}

export interface FrontendRecommendationBatch {
  seed: {
    mode: RecommendationMode;
    canonicalTrackId?: string;
  };
  seedLabel: string;
  items: FrontendRecommendedTrack[];
}

interface RecommendationStreamBatchOptions {
  limit?: number;
  mode?: RecommendationMode;
  seedVariantTrackId?: string | null;
  seedCanonicalTrackId?: string | null;
  excludeCanonicalTrackIds?: string[];
  recentRecommendationIds?: string[];
}

function canUseRecommendations() {
  return useAuthStore.getState().isAuthenticated;
}

function getTrackMap() {
  const state = useAppStore.getState();

  return {
    ...state.downloadedTracks,
    ...state.tracks,
  };
}

function getRecommendationRelevantTracks(extraTrackIds: string[] = []) {
  const state = useAppStore.getState();
  const trackMap = getTrackMap();
  const prioritizedTrackIds = dedupe([
    ...extraTrackIds,
    state.currentTrackId ?? "",
    ...state.currentQueue,
    ...state.originalQueue,
    ...state.favorites,
    ...state.listenHistory.map((entry) => entry.trackId),
  ]);

  return prioritizedTrackIds
    .map((trackId) => trackMap[trackId])
    .filter((track): track is Track => !!track)
    .slice(0, 200);
}

async function ensureRecommendationCatalogSynced(extraTrackIds: string[] = []) {
  if (!canUseRecommendations()) {
    return;
  }

  await serverTrackCatalogService.syncTracks(getRecommendationRelevantTracks(extraTrackIds));
}

function hydrateTracks(tracks: Track[]) {
  if (!tracks.length) {
    return;
  }

  useAppStore.getState().hydrateCatalog(tracks);
}

function normalizeRecommendedTrack(input: FrontendRecommendedTrack): FrontendRecommendedTrack {
  return {
    ...input,
    track: input.track,
  };
}

export const recommendationFacade = {
  canUseRecommendations,

  async getNextRecommendedTrack() {
    if (!canUseRecommendations()) {
      return null;
    }

    const state = useAppStore.getState();
    await ensureRecommendationCatalogSynced(state.currentTrackId ? [state.currentTrackId] : []);

    const result = await apiClient.request<FrontendRecommendedTrack | null>(
      "/me/recommendations/next-track",
      {
        method: "POST",
        body: {
          currentTrackId: state.currentTrackId,
          mode: "autoplay",
        },
      },
    );

    if (result?.track) {
      hydrateTracks([result.track]);
      return normalizeRecommendedTrack(result);
    }

    return null;
  },

  async getRecommendationStreamBatch(options: RecommendationStreamBatchOptions = {}) {
    if (!canUseRecommendations()) {
      return {
        seed: {
          mode: options.mode ?? "autoplay",
        },
        seedLabel: "требуется вход",
        items: [],
      } satisfies FrontendRecommendationBatch;
    }

    await ensureRecommendationCatalogSynced(
      dedupe([options.seedVariantTrackId ?? "", ...useAppStore.getState().favorites]),
    );

    const batch = await apiClient.request<FrontendRecommendationBatch>("/me/recommendations/stream", {
      method: "POST",
      body: {
        limit: options.limit ?? 12,
        mode: options.mode ?? "autoplay",
        seedTrackId: options.seedVariantTrackId ?? null,
        currentTrackId: useAppStore.getState().currentTrackId,
        excludeTrackIds: options.excludeCanonicalTrackIds ?? [],
        recentRecommendationTrackIds: options.recentRecommendationIds ?? [],
      },
    });

    hydrateTracks(batch.items.map((item) => item.track));

    return {
      ...batch,
      items: batch.items.map(normalizeRecommendedTrack),
    };
  },

  async updatePlaybackAffinityForVariantTrack(
    trackId: string,
    payload: {
      listenedMs: number;
      trackDurationMs: number;
      endedNaturally: boolean;
      wasSkipped: boolean;
      seedChannels?: RecommendationChannel[];
    },
  ) {
    if (!canUseRecommendations()) {
      return;
    }

    await ensureRecommendationCatalogSynced([trackId]);
    await apiClient.request<void>("/me/recommendations/events/playback", {
      method: "POST",
      parseAs: "void",
      body: {
        trackId,
        listenedMs: payload.listenedMs,
        trackDurationMs: payload.trackDurationMs,
        occurredAt: new Date().toISOString(),
        endedNaturally: payload.endedNaturally,
        wasSkipped: payload.wasSkipped,
        sessionId: currentSessionId,
        seedChannels: payload.seedChannels?.length
          ? payload.seedChannels
          : ["sessionContinuation"],
      },
    });
  },

  async updateFavoriteAffinityForVariantTrack(trackId: string, isFavorite: boolean) {
    if (!canUseRecommendations()) {
      return;
    }

    await ensureRecommendationCatalogSynced([trackId]);
    await apiClient.request<void>("/me/recommendations/events/favorite", {
      method: "POST",
      parseAs: "void",
      body: {
        trackId,
        occurredAt: new Date().toISOString(),
        isFavorite,
      },
    });
  },

  async updatePlaylistAffinityForVariantTrack(trackId: string, playlistId: string, isAdded: boolean) {
    if (!canUseRecommendations()) {
      return;
    }

    await ensureRecommendationCatalogSynced([trackId]);
    await apiClient.request<void>("/me/recommendations/events/playlist", {
      method: "POST",
      parseAs: "void",
      body: {
        trackId,
        playlistId,
        occurredAt: new Date().toISOString(),
        isAdded,
      },
    });
  },
};
