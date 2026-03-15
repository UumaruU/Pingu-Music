import { LruCache } from "./lruCache";

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export class TtlCache<K, V> {
  private readonly ttlMs: number;
  private readonly cache: LruCache<K, CacheEntry<V>>;

  constructor(options: { maxSize: number; ttlMs: number }) {
    this.ttlMs = Math.max(1, options.ttlMs);
    this.cache = new LruCache<K, CacheEntry<V>>(options.maxSize);
  }

  get(key: K) {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: K, value: V, ttlMs = this.ttlMs) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + Math.max(1, ttlMs),
    });
  }

  delete(key: K) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}
