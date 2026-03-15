import { TtlCache } from "../../core/cache/ttlCache";
import { providerRegistry } from "../../core/providers/providerRegistry";
import { ProviderId, Track } from "../../types";

const POPULAR_TTL_MS = 10 * 60 * 1000;
const POPULAR_CACHE_SIZE = 8;

function getCacheKey(providerId: ProviderId) {
  return `${providerId}:popular`;
}

class DiscoveryService {
  private readonly cache = new TtlCache<string, Track[]>({
    maxSize: POPULAR_CACHE_SIZE,
    ttlMs: POPULAR_TTL_MS,
  });

  private readonly inFlight = new Map<string, Promise<Track[]>>();

  async getPopular(providerId: ProviderId) {
    const cacheKey = getCacheKey(providerId);
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
      .then(async (provider) => {
        if (!("getPopular" in provider) || typeof provider.getPopular !== "function") {
          return [];
        }

        return provider.getPopular();
      })
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
}

export const discoveryService = new DiscoveryService();
