export interface CacheEntry {
  value: any;
  expiresAt: number;
}

export class InMemoryCache {
  private static cache = new Map<string, CacheEntry>();

  /**
   * Retrieves an item from the cache.
   * Returns null if key is not found, expired, or if cache is disabled.
   */
  static get(key: string): any {
    if (process.env.DISABLE_CACHE === 'true') {
      return null;
    }

    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Stores an item in the cache with a specified TTL in seconds.
   */
  static set(key: string, value: any, ttlSeconds: number): void {
    if (process.env.DISABLE_CACHE === 'true') {
      return;
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Removes a specific item from the cache.
   */
  static delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clears all cache entries.
   */
  static clear(): void {
    this.cache.clear();
  }
}
