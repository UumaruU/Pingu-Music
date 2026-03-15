import { TtlCache } from "../../core/cache/ttlCache";
import { providerRegistry } from "../../core/providers/providerRegistry";
import { ProviderId, Track } from "../../types";

const SEARCH_TTL_MS = 10 * 60 * 1000;
const SEARCH_CACHE_SIZE = 80;

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function getCacheKey(providerId: ProviderId, query: string) {
  return `${providerId}:${normalizeQuery(query)}`;
}

class SearchService {
  private readonly cache = new TtlCache<string, Track[]>({
    maxSize: SEARCH_CACHE_SIZE,
    ttlMs: SEARCH_TTL_MS,
  });

  private readonly inFlight = new Map<string, Promise<Track[]>>();

  async search(providerId: ProviderId, query: string) {
    const cacheKey = getCacheKey(providerId, query);
    const cachedTracks = this.cache.get(cacheKey);

    if (cachedTracks) {
      return cachedTracks;
    }

    const activeRequest = this.inFlight.get(cacheKey);

    if (activeRequest) {
      return activeRequest;
    }

    const request = providerRegistry
      .getProvider(providerId)
      .then((provider) => provider.search(query))
      .then((tracks) => {
        this.cache.set(cacheKey, tracks);
        return tracks;
      })
      .finally(() => {
        this.inFlight.delete(cacheKey);
      });

    this.inFlight.set(cacheKey, request);
    return request;
  }

  async searchMany(providerIds: ProviderId[], query: string) {
    const uniqueProviderIds = [...new Set(providerIds)];

    if (!uniqueProviderIds.length) {
      return [];
    }

    const settledResults = await Promise.allSettled(
      uniqueProviderIds.map((providerId) => this.search(providerId, query)),
    );

    const tracks: Track[] = [];
    const errors: Error[] = [];

    settledResults.forEach((result) => {
      if (result.status === "fulfilled") {
        tracks.push(...result.value);
        return;
      }

      errors.push(result.reason instanceof Error ? result.reason : new Error("Search failed"));
    });

    if (!tracks.length && errors.length === uniqueProviderIds.length) {
      throw errors[0];
    }

    return tracks;
  }
}

export const searchService = new SearchService();