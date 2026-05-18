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
  requestId?: string;
  strategy?: string;
  contextSummary?: string;
  queueMode?: "single-next" | "batch";
  visibleQueueLength?: number;
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
  currentTrackId?: string | null;
  excludeTrackIds?: string[];
  recentRecommendationTrackIds?: string[];
  excludeCanonicalTrackIds?: string[];
  recentRecommendationIds?: string[];
}

export interface RecommendationImpressionInput {
  requestId: string;
  surface: string;
  position: number;
  trackId: string;
  occurredAt?: string;
}

export interface RecommendationInteractionInput {
  requestId: string;
  surface: string;
  position: number;
  trackId: string;
  action: "play" | "skip" | "open" | "favorite" | "playlist_add" | "dislike" | "dismiss";
  listenedMs?: number;
  trackDurationMs?: number;
  playlistId?: string;
  metadata?: Record<string, unknown> | null;
  occurredAt?: string;
}

type UnifiedRecommendationEventType =
  | "impression"
  | "play"
  | "skip"
  | "seek"
  | "like"
  | "save"
  | "add_to_playlist"
  | "share";

interface UnifiedRecommendationEventInput {
  type: UnifiedRecommendationEventType;
  track_id?: string;
  artist_id?: string;
  session_id?: string;
  source_surface?: string;
  position?: number;
  timestamp?: string;
  recommendation_request_id?: string;
  context?: Record<string, unknown> | null;
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

async function sendRecommendationEvents(events: UnifiedRecommendationEventInput[], keepalive = false) {
  if (!canUseRecommendations() || !events.length) {
    return;
  }

  await apiClient.request<void>("/me/recommendations/events", {
    method: "POST",
    parseAs: "void",
    keepalive,
    body: {
      events,
    },
  });
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
        currentTrackId: options.currentTrackId ?? useAppStore.getState().currentTrackId,
        excludeTrackIds: options.excludeTrackIds ?? options.excludeCanonicalTrackIds ?? [],
        recentRecommendationTrackIds:
          options.recentRecommendationTrackIds ?? options.recentRecommendationIds ?? [],
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
    await sendRecommendationEvents([
      {
        type: payload.wasSkipped ? "skip" : "play",
        track_id: trackId,
        session_id: currentSessionId,
        timestamp: new Date().toISOString(),
        context: {
          listenedMs: payload.listenedMs,
          trackDurationMs: payload.trackDurationMs,
          endedNaturally: payload.endedNaturally,
          wasSkipped: payload.wasSkipped,
          seedChannels: payload.seedChannels?.length ? payload.seedChannels : undefined,
        },
      },
    ]);
  },

  async updateFavoriteAffinityForVariantTrack(trackId: string, isFavorite: boolean) {
    if (!canUseRecommendations()) {
      return;
    }

    await ensureRecommendationCatalogSynced([trackId]);
    if (isFavorite) {
      await sendRecommendationEvents([
        {
          type: "like",
          track_id: trackId,
          timestamp: new Date().toISOString(),
          context: {
            isFavorite,
          },
        },
      ]);
      return;
    }

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
    if (isAdded) {
      await sendRecommendationEvents([
        {
          type: "add_to_playlist",
          track_id: trackId,
          timestamp: new Date().toISOString(),
          context: {
            playlistId,
            isAdded,
          },
        },
      ]);
      return;
    }

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

  async recordRecommendationImpressions(items: RecommendationImpressionInput[]) {
    if (!canUseRecommendations() || !items.length) {
      return;
    }

    await ensureRecommendationCatalogSynced(items.map((item) => item.trackId));
    await sendRecommendationEvents(
      items.map((item) => ({
        type: "impression",
        track_id: item.trackId,
        source_surface: item.surface,
        position: item.position,
        timestamp: item.occurredAt ?? new Date().toISOString(),
        recommendation_request_id: item.requestId,
      })),
      true,
    );
  },

  async recordRecommendationInteraction(input: RecommendationInteractionInput) {
    if (!canUseRecommendations()) {
      return;
    }

    await ensureRecommendationCatalogSynced([input.trackId]);
    const unifiedType =
      input.action === "play"
        ? "play"
        : input.action === "skip" || input.action === "dismiss"
          ? "skip"
          : input.action === "favorite"
            ? "like"
            : input.action === "playlist_add"
              ? "add_to_playlist"
              : null;

    if (unifiedType) {
      await sendRecommendationEvents(
        [
          {
            type: unifiedType,
            track_id: input.trackId,
            source_surface: input.surface,
            position: input.position,
            timestamp: input.occurredAt ?? new Date().toISOString(),
            recommendation_request_id: input.requestId,
            context: {
              action: input.action,
              listenedMs: input.listenedMs,
              trackDurationMs: input.trackDurationMs,
              playlistId: input.playlistId,
              metadata: input.metadata ?? null,
            },
          },
        ],
        true,
      );
      return;
    }

    if (input.action === "dislike") {
      await recommendationFacade.updateDislikeAffinityForVariantTrack(input.trackId, true);
      return;
    }

    await apiClient.request<void>("/me/recommendations/events/interaction", {
      method: "POST",
      parseAs: "void",
      keepalive: true,
      body: {
        requestId: input.requestId,
        surface: input.surface,
        position: input.position,
        trackId: input.trackId,
        action: input.action,
        occurredAt: input.occurredAt ?? new Date().toISOString(),
        listenedMs: input.listenedMs,
        trackDurationMs: input.trackDurationMs,
        playlistId: input.playlistId,
        metadata: input.metadata,
      },
    });
  },

  async updateDislikeAffinityForVariantTrack(trackId: string, isDisliked: boolean) {
    if (!canUseRecommendations()) {
      return;
    }

    await ensureRecommendationCatalogSynced([trackId]);
    await apiClient.request<void>("/me/recommendations/events/dislike", {
      method: "POST",
      parseAs: "void",
      keepalive: true,
      body: {
        trackId,
        occurredAt: new Date().toISOString(),
        isDisliked,
      },
    });
  },
};
