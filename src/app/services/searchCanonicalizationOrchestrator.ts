import { canonicalizationConfig } from "../config/canonicalizationConfig";
import { useAppStore } from "../store/appStore";
import { Track } from "../types";
import { trackCanonicalizationService } from "./trackCanonicalizationService";

const RECOMPUTE_DEBOUNCE_MS = 180;

class SearchCanonicalizationOrchestrator {
  private debounceTimer: number | null = null;

  private getActiveSearchTracks() {
    const state = useAppStore.getState();

    return state.searchVariantResultIds
      .map((trackId) => state.tracks[trackId])
      .filter((track): track is Track => !!track);
  }

  private buildNextRevision() {
    return useAppStore.getState().canonicalizationRevision + 1;
  }

  clearProjection() {
    if (this.debounceTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    useAppStore.getState().clearSearchCanonicalization();
  }

  recomputeActiveSearchProjection() {
    const state = useAppStore.getState();

    if (!canonicalizationConfig.enableTrackCanonicalization || !state.activeSearchSetId) {
      return;
    }

    const tracks = this.getActiveSearchTracks();

    if (!tracks.length) {
      useAppStore.getState().clearSearchCanonicalization();
      return;
    }

    const result = trackCanonicalizationService.buildCanonicalizationResult({
      searchSetId: state.activeSearchSetId,
      tracks,
      lyricsByTrackId: state.lyricsByTrackId,
      previousResult:
        state.searchCanonicalResult?.searchSetId === state.activeSearchSetId
          ? state.searchCanonicalResult
          : null,
      canonicalizationRevision: this.buildNextRevision(),
      config: canonicalizationConfig,
      includeDebugInfo: import.meta.env.DEV || import.meta.env.MODE === "test",
    });

    useAppStore.getState().setSearchCanonicalization(result);
  }

  recomputeActiveSearchProjectionDebounced() {
    if (typeof window === "undefined") {
      this.recomputeActiveSearchProjection();
      return;
    }

    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      this.recomputeActiveSearchProjection();
    }, RECOMPUTE_DEBOUNCE_MS);
  }

  hydrateSearchResults(searchSetId: string, trackIds: string[]) {
    useAppStore.getState().setActiveSearchSet(searchSetId, trackIds);
    this.recomputeActiveSearchProjection();
  }

  refreshTrack(trackId: string) {
    const state = useAppStore.getState();

    if (!state.searchVariantResultIds.includes(trackId)) {
      return;
    }

    this.recomputeActiveSearchProjectionDebounced();
  }
}

export const searchCanonicalizationOrchestrator = new SearchCanonicalizationOrchestrator();
