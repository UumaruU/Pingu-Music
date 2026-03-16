import { LazyStore } from "@tauri-apps/plugin-store";
import { tauriBridge } from "./tauriBridge";

type CacheSection = "tracks" | "artists" | "releases" | "lyrics" | "artwork" | "recommendation";

interface CacheEnvelope<T> {
  payload: T;
  cachedAt: string;
  expiresAt: string;
}

const CACHE_FILE_NAME = "library-cache.json";
const CACHE_TTL_DAYS = 30;
const CACHE_PREFIX = "pingu-music-cache";
const CACHE_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

function getCacheKey(section: CacheSection, key: string) {
  return `${section}:${key}`;
}

function getExpiresAt(now = Date.now()) {
  return new Date(now + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function isExpired(expiresAt: string) {
  return Date.parse(expiresAt) <= Date.now();
}

class CacheService {
  private tauriStore = new LazyStore(CACHE_FILE_NAME, {
    autoSave: 250,
    defaults: {},
  });
  private lastCleanupAt = 0;
  private cleanupTask: Promise<void> | null = null;

  private async getWebEntries() {
    if (typeof window === "undefined") {
      return [];
    }

    const entries: Array<[string, string]> = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);

      if (!key || !key.startsWith(`${CACHE_PREFIX}:`)) {
        continue;
      }

      const value = window.localStorage.getItem(key);

      if (value === null) {
        continue;
      }

      entries.push([key.replace(`${CACHE_PREFIX}:`, ""), value]);
    }

    return entries;
  }

  private async getStoreEntries() {
    if (tauriBridge.isTauriRuntime()) {
      return this.tauriStore.entries<CacheEnvelope<unknown>>();
    }

    const entries = await this.getWebEntries();

    return entries
      .map(([key, value]) => {
        try {
          return [key, JSON.parse(value) as CacheEnvelope<unknown>] as [string, CacheEnvelope<unknown>];
        } catch {
          return [key, undefined] as unknown as [string, CacheEnvelope<unknown>];
        }
      })
      .filter((entry): entry is [string, CacheEnvelope<unknown>] => !!entry[1]);
  }

  async get<T>(section: CacheSection, key: string): Promise<T | undefined> {
    const cacheKey = getCacheKey(section, key);

    if (tauriBridge.isTauriRuntime()) {
      const envelope = await this.tauriStore.get<CacheEnvelope<T>>(cacheKey);

      if (!envelope) {
        return undefined;
      }

      if (isExpired(envelope.expiresAt)) {
        await this.tauriStore.delete(cacheKey);
        return undefined;
      }

      return envelope.payload;
    }

    if (typeof window === "undefined") {
      return undefined;
    }

    const rawValue = window.localStorage.getItem(`${CACHE_PREFIX}:${cacheKey}`);

    if (!rawValue) {
      return undefined;
    }

    try {
      const envelope = JSON.parse(rawValue) as CacheEnvelope<T>;

      if (isExpired(envelope.expiresAt)) {
        window.localStorage.removeItem(`${CACHE_PREFIX}:${cacheKey}`);
        return undefined;
      }

      return envelope.payload;
    } catch {
      window.localStorage.removeItem(`${CACHE_PREFIX}:${cacheKey}`);
      return undefined;
    }
  }

  async set<T>(section: CacheSection, key: string, payload: T) {
    const envelope: CacheEnvelope<T> = {
      payload,
      cachedAt: new Date().toISOString(),
      expiresAt: getExpiresAt(),
    };
    const cacheKey = getCacheKey(section, key);

    if (tauriBridge.isTauriRuntime()) {
      await this.tauriStore.set(cacheKey, envelope);
      void this.cleanupExpired(false);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(`${CACHE_PREFIX}:${cacheKey}`, JSON.stringify(envelope));
    void this.cleanupExpired(false);
  }

  async remove(section: CacheSection, key: string) {
    const cacheKey = getCacheKey(section, key);

    if (tauriBridge.isTauriRuntime()) {
      await this.tauriStore.delete(cacheKey);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.removeItem(`${CACHE_PREFIX}:${cacheKey}`);
  }

  async cleanupExpired(force = true) {
    if (!force && Date.now() - this.lastCleanupAt < CACHE_CLEANUP_INTERVAL_MS) {
      return this.cleanupTask ?? undefined;
    }

    if (this.cleanupTask) {
      return this.cleanupTask;
    }

    this.cleanupTask = (async () => {
      const entries = await this.getStoreEntries();

      await Promise.all(
        entries.map(async ([key, envelope]) => {
          if (!isExpired(envelope.expiresAt)) {
            return;
          }

          if (tauriBridge.isTauriRuntime()) {
            await this.tauriStore.delete(key);
            return;
          }

          if (typeof window !== "undefined") {
            window.localStorage.removeItem(`${CACHE_PREFIX}:${key}`);
          }
        }),
      );

      this.lastCleanupAt = Date.now();
    })().finally(() => {
      this.cleanupTask = null;
    });

    return this.cleanupTask;
  }
}

export const cacheService = new CacheService();
