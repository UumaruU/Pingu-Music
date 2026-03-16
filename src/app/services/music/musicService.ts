import { useAppStore } from "../../store/appStore";
import { ProviderId, Track } from "../../types";
import {
  extractPrimaryArtistName,
  normalizationService,
} from "../normalizationService";
import { searchCanonicalizationOrchestrator } from "../searchCanonicalizationOrchestrator";
import { discoveryService } from "./discoveryService";
import { searchService } from "./searchService";

const DISCOVERY_PROVIDER_ID = "hitmos" as const;
const SEARCH_PROVIDER_IDS: ProviderId[] = ["hitmos", "lmusic", "soundcloud"];
const INITIAL_METADATA_PREFETCH_LIMIT = 4;
const SEARCH_METADATA_PREFETCH_LIMIT = 6;
const ARTIST_METADATA_PREFETCH_LIMIT = 8;
const METADATA_PREFETCH_DELAY_MS = 350;

function matchesArtistTrack(
  track: Track,
  artistId: string,
  normalizedArtistName: string,
) {
  if (track.musicBrainzArtistId === artistId) {
    return true;
  }

  const primaryTrackArtistName = normalizationService.normalizeArtistName(
    extractPrimaryArtistName(track.normalizedArtistName ?? track.artist),
  );
  const fullTrackArtistName = normalizationService.normalizeArtistName(
    track.normalizedArtistName ?? track.artist,
  );

  return (
    primaryTrackArtistName === normalizedArtistName ||
    primaryTrackArtistName.includes(normalizedArtistName) ||
    normalizedArtistName.includes(primaryTrackArtistName) ||
    fullTrackArtistName.includes(normalizedArtistName)
  );
}

class MusicService {
  private activeArtistPreloads = new Map<string, Promise<Track[]>>();
  private queuedMetadataTrackIds = new Set<string>();
  private latestSearchRequestId = 0;

  private createSearchSetId(query: string) {
    const normalizedQuery = normalizationService.normalizeTrackTitle(query || "");

    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `search:${normalizedQuery}:${crypto.randomUUID()}`;
    }

    return `search:${normalizedQuery}:${Date.now()}`;
  }

  private deferMetadataPrefetch(trackIds: string[], limit: number) {
    const queuedTrackIds = trackIds
      .filter((trackId, index, allTrackIds) => allTrackIds.indexOf(trackId) === index)
      .filter((trackId) => {
        const track = useAppStore.getState().tracks[trackId];

        if (!track || track.metadataStatus !== "raw") {
          return false;
        }

        return !this.queuedMetadataTrackIds.has(trackId);
      })
      .slice(0, limit);

    if (!queuedTrackIds.length) {
      return;
    }

    queuedTrackIds.forEach((trackId) => this.queuedMetadataTrackIds.add(trackId));

    const runPrefetch = () => {
      void import("../metadataEnrichmentService")
        .then(({ metadataEnrichmentService }) => {
          const freshTrackIds = queuedTrackIds.filter((trackId) => {
            const track = useAppStore.getState().tracks[trackId];
            return !!track && track.metadataStatus === "raw";
          });

          if (!freshTrackIds.length) {
            return;
          }

          metadataEnrichmentService.enrichTracks(freshTrackIds);
        })
        .finally(() => {
          queuedTrackIds.forEach((trackId) => this.queuedMetadataTrackIds.delete(trackId));
        });
    };

    if (typeof window === "undefined") {
      void Promise.resolve().then(runPrefetch);
      return;
    }

    window.setTimeout(runPrefetch, METADATA_PREFETCH_DELAY_MS);
  }

  async loadPopularTracks() {
    const state = useAppStore.getState();

    if (state.popularTrackIds.length) {
      const cachedTracks = state.popularTrackIds
        .map((trackId) => state.tracks[trackId])
        .filter((track): track is Track => !!track);

      if (cachedTracks.length === state.popularTrackIds.length) {
        return cachedTracks;
      }
    }

    const tracks = await discoveryService.getPopular(DISCOVERY_PROVIDER_ID);
    useAppStore.getState().setPopularTracks(tracks);
    this.deferMetadataPrefetch(
      tracks.map((track) => track.id),
      INITIAL_METADATA_PREFETCH_LIMIT,
    );
    return tracks;
  }

  async preloadArtistTracks(artistId: string, artistName: string) {
    const normalizedArtistName = artistName.trim();

    if (!artistId || !normalizedArtistName) {
      return [];
    }

    const activePreload = this.activeArtistPreloads.get(artistId);

    if (activePreload) {
      return activePreload;
    }

    const store = useAppStore.getState();
    const normalizedTargetArtistName = normalizationService.normalizeArtistName(
      extractPrimaryArtistName(normalizedArtistName),
    );

    store.setArtistTrackStatus(artistId, "loading");

    const preloadPromise = searchService
      .searchMany(SEARCH_PROVIDER_IDS, normalizedArtistName)
      .then((tracks) => {
        const nextStore = useAppStore.getState();
        nextStore.hydrateCatalog(tracks);
        const artistTracks = tracks.filter((track) =>
          matchesArtistTrack(track, artistId, normalizedTargetArtistName),
        );
        const artistTrackIds = artistTracks.map((track) => track.id);
        const existingTrackIds = nextStore.artistTrackIdsByArtistId[artistId] ?? [];
        const mergedTrackIds = Array.from(new Set([...existingTrackIds, ...artistTrackIds]));

        nextStore.setArtistTracks(artistId, mergedTrackIds);
        nextStore.setArtistTrackStatus(artistId, "ready");
        this.deferMetadataPrefetch(mergedTrackIds, ARTIST_METADATA_PREFETCH_LIMIT);
        return artistTracks;
      })
      .catch((error) => {
        useAppStore.getState().setArtistTrackStatus(artistId, "failed");
        throw error;
      })
      .finally(() => {
        this.activeArtistPreloads.delete(artistId);
      });

    this.activeArtistPreloads.set(artistId, preloadPromise);
    return preloadPromise;
  }

  async searchCandidateTracks(query: string) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return [];
    }

    const tracks = await searchService.searchMany(SEARCH_PROVIDER_IDS, normalizedQuery);
    useAppStore.getState().hydrateCatalog(tracks);
    return tracks;
  }

  async searchTracks(query: string) {
    const trimmedQuery = query.trim();
    const requestId = ++this.latestSearchRequestId;

    useAppStore
      .getState()
      .setSearchState({ query, trackIds: [], status: "loading", error: null });

    if (!trimmedQuery) {
      await this.loadPopularTracks();
      searchCanonicalizationOrchestrator.clearProjection();

      if (requestId === this.latestSearchRequestId) {
        useAppStore
          .getState()
          .setSearchState({ query: "", trackIds: [], status: "idle", error: null });
      }

      return [];
    }

    try {
      const tracks = await searchService.searchMany(SEARCH_PROVIDER_IDS, trimmedQuery);
      useAppStore.getState().hydrateCatalog(tracks);

      if (requestId !== this.latestSearchRequestId) {
        return tracks;
      }

      const searchSetId = this.createSearchSetId(trimmedQuery);

      useAppStore.getState().setSearchState({
        query,
        trackIds: tracks.map((track) => track.id),
        status: tracks.length ? "success" : "empty",
        error: null,
      });
      searchCanonicalizationOrchestrator.hydrateSearchResults(
        searchSetId,
        tracks.map((track) => track.id),
      );

      this.deferMetadataPrefetch(
        tracks.map((track) => track.id),
        SEARCH_METADATA_PREFETCH_LIMIT,
      );

      return tracks;
    } catch (error) {
      if (requestId !== this.latestSearchRequestId) {
        return [];
      }

      const message = error instanceof Error ? error.message : "Failed to load tracks";

      useAppStore
        .getState()
        .setSearchState({ query, trackIds: [], status: "error", error: message });
      searchCanonicalizationOrchestrator.clearProjection();

      return [];
    }
  }
}

export const musicService = new MusicService();
