import { ProviderId, Track } from "../../types";
import { TtlCache } from "../cache/ttlCache";
import { providerRegistry } from "../providers/providerRegistry";
import { getProviderTrackId } from "../tracks/trackIdentity";

const STREAM_TTL_MS = 5 * 60 * 1000;
const STREAM_CACHE_SIZE = 250;

function getStreamCacheKey(providerId: ProviderId, trackId: string) {
  return `${providerId}:${trackId}`;
}

class StreamResolver {
  private readonly cache = new TtlCache<string, string>({
    maxSize: STREAM_CACHE_SIZE,
    ttlMs: STREAM_TTL_MS,
  });

  private readonly inFlight = new Map<string, Promise<string>>();

  async resolve(track: Track) {
    const trackId = getProviderTrackId(track);
    const cacheKey = getStreamCacheKey(track.providerId, trackId);
    const cachedStream = this.cache.get(cacheKey);

    if (cachedStream) {
      return cachedStream;
    }

    const activeResolution = this.inFlight.get(cacheKey);

    if (activeResolution) {
      return activeResolution;
    }

    const resolution = providerRegistry
      .getProvider(track.providerId)
      .then((provider) => provider.getStream(trackId))
      .then((streamUrl) => {
        const nextStreamUrl = streamUrl || track.audioUrl;

        if (!nextStreamUrl) {
          throw new Error(`Unable to resolve stream for track "${track.id}"`);
        }

        this.cache.set(cacheKey, nextStreamUrl);
        return nextStreamUrl;
      })
      .catch((error) => {
        if (track.audioUrl) {
          this.cache.set(cacheKey, track.audioUrl, 60 * 1000);
          return track.audioUrl;
        }

        throw error;
      })
      .finally(() => {
        this.inFlight.delete(cacheKey);
      });

    this.inFlight.set(cacheKey, resolution);
    return resolution;
  }
}

export const streamResolver = new StreamResolver();
