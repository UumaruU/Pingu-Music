export class LruCache<K, V> {
  private readonly maxSize: number;
  private readonly entries = new Map<K, V>();

  constructor(maxSize: number) {
    this.maxSize = Math.max(1, maxSize);
  }

  get(key: K) {
    if (!this.entries.has(key)) {
      return undefined;
    }

    const value = this.entries.get(key) as V;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: K, value: V) {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }

    this.entries.set(key, value);

    while (this.entries.size > this.maxSize) {
      const oldestKey = this.entries.keys().next().value;

      if (oldestKey === undefined) {
        break;
      }

      this.entries.delete(oldestKey);
    }
  }

  has(key: K) {
    return this.entries.has(key);
  }

  delete(key: K) {
    this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
  }
}
