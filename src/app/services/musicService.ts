import { HitmosProvider } from "../providers/hitmosProvider";
import { useAppStore } from "../store/appStore";
import { Track } from "../types";
import {
  extractPrimaryArtistName,
  normalizationService,
} from "./normalizationService";

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
  private provider = new HitmosProvider();
  private activeArtistPreloads = new Map<string, Promise<Track[]>>();
  private activeCandidateSearches = new Map<string, Promise<Track[]>>();
  private activeSearchRequests = new Map<string, Promise<Track[]>>();
  private activePopularTracksRequest: Promise<Track[]> | null = null;
  private queuedMetadataTrackIds = new Set<string>();
  private latestSearchRequestId = 0;

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
      void import("./metadataEnrichmentService")
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

    if (this.activePopularTracksRequest) {
      return this.activePopularTracksRequest;
    }

    const request = this.provider
      .getPopularTracks()
      .then((tracks) => {
        useAppStore.getState().setPopularTracks(tracks);
        this.deferMetadataPrefetch(
          tracks.map((track) => track.id),
          INITIAL_METADATA_PREFETCH_LIMIT,
        );
        return tracks;
      })
      .finally(() => {
        this.activePopularTracksRequest = null;
      });

    this.activePopularTracksRequest = request;
    return request;
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

    const preloadPromise = this.provider
      .searchTracks(normalizedArtistName)
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
        this.deferMetadataPrefetch(
          mergedTrackIds,
          ARTIST_METADATA_PREFETCH_LIMIT,
        );
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

    const cacheKey = normalizedQuery.toLowerCase();
    const activeRequest = this.activeCandidateSearches.get(cacheKey);

    if (activeRequest) {
      return activeRequest;
    }

    const request = this.provider
      .searchTracks(normalizedQuery)
      .then((tracks) => {
        useAppStore.getState().hydrateCatalog(tracks);
        return tracks;
      })
      .finally(() => {
        this.activeCandidateSearches.delete(cacheKey);
      });

    this.activeCandidateSearches.set(cacheKey, request);
    return request;
  }

  async searchTracks(query: string) {
    const trimmedQuery = query.trim();
    const requestId = ++this.latestSearchRequestId;

    useAppStore
      .getState()
      .setSearchState({ query, trackIds: [], status: "loading", error: null });

    if (!trimmedQuery) {
      await this.loadPopularTracks();

      if (requestId === this.latestSearchRequestId) {
        useAppStore
          .getState()
          .setSearchState({ query: "", trackIds: [], status: "idle", error: null });
      }

      return [];
    }

    try {
      const cacheKey = trimmedQuery.toLowerCase();
      const activeRequest = this.activeSearchRequests.get(cacheKey);
      const request =
        activeRequest ??
        this.provider
          .searchTracks(trimmedQuery)
          .then((tracks) => {
            useAppStore.getState().hydrateCatalog(tracks);
            return tracks;
          })
          .finally(() => {
            this.activeSearchRequests.delete(cacheKey);
          });

      if (!activeRequest) {
        this.activeSearchRequests.set(cacheKey, request);
      }

      const tracks = await request;

      if (requestId !== this.latestSearchRequestId) {
        return tracks;
      }

      useAppStore.getState().setSearchState({
        query,
        trackIds: tracks.map((track) => track.id),
        status: tracks.length ? "success" : "empty",
        error: null,
      });

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

      return [];
    }
  }
}

export const musicService = new MusicService();
