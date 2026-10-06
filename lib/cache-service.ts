/**
 * Redis Cache Service
 *
 * Provides unified caching interface for frequently accessed data.
 * Automatically handles cache invalidation on mutations.
 *
 * Usage:
 *  const cache = new CacheService(redis);
 *  const profile = await cache.getOrFetch('profile:user123', async () => {
 *    return await db.profiles.fetch(user123);
 *  }, 300); // 5 minute TTL
 *
 * Key patterns:
 *  - profile:{userId}: User profile data (5 min)
 *  - team-context:{userId}:{orgId}: User's teams in org (5 min)
 *  - teams:{orgId}: All teams in organization (5 min)
 *  - team-members:{teamId}: Team members list (5 min)
 *  - user-search:{query}: Search results (1 min)
 */

interface CacheOptions {
  ttl?: number; // TTL in seconds
  namespace?: string;
}

export class CacheService {
  private redis: any; // Redis client
  private readonly defaultTtl = 300; // 5 minutes
  private readonly namespace = 'followthru';

  constructor(redis: any) {
    this.redis = redis;
  }

  /**
   * Generate a full cache key with namespace.
   */
  private key(name: string): string {
    return `${this.namespace}:${name}`;
  }

  /**
   * Get value from cache, or fetch if missing.
   * Stores fetched value in cache for TTL duration.
   */
  async getOrFetch<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const fullKey = this.key(cacheKey);
    const ttlSeconds = ttl ?? this.defaultTtl;

    try {
      // Try cache first
      const cached = await this.redis.get(fullKey);
      if (cached) {
        console.debug(`[Cache] HIT: ${cacheKey}`);
        try {
          return JSON.parse(cached);
        } catch {
          // If parse fails, invalidate and fetch fresh
          await this.redis.del(fullKey);
        }
      }

      console.debug(`[Cache] MISS: ${cacheKey}`);

      // Fetch fresh data
      const data = await fetcher();

      // Store in cache
      await this.redis.setex(fullKey, ttlSeconds, JSON.stringify(data));
      console.debug(`[Cache] SET: ${cacheKey} (TTL: ${ttlSeconds}s)`);

      return data;
    } catch (err) {
      console.error(`[Cache] Error for ${cacheKey}:`, err);
      // On cache error, still fetch fresh data
      return fetcher();
    }
  }

  /**
   * Get value from cache without fetching.
   */
  async get<T>(cacheKey: string): Promise<T | null> {
    const fullKey = this.key(cacheKey);

    try {
      const cached = await this.redis.get(fullKey);
      if (cached) {
        console.debug(`[Cache] GET: ${cacheKey}`);
        return JSON.parse(cached);
      }
      return null;
    } catch (err) {
      console.error(`[Cache] Get error for ${cacheKey}:`, err);
      return null;
    }
  }

  /**
   * Set value in cache.
   */
  async set<T>(cacheKey: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.key(cacheKey);
    const ttlSeconds = ttl ?? this.defaultTtl;

    try {
      await this.redis.setex(fullKey, ttlSeconds, JSON.stringify(value));
      console.debug(`[Cache] SET: ${cacheKey} (TTL: ${ttlSeconds}s)`);
    } catch (err) {
      console.error(`[Cache] Set error for ${cacheKey}:`, err);
    }
  }

  /**
   * Invalidate a specific cache entry.
   */
  async invalidate(cacheKey: string): Promise<void> {
    const fullKey = this.key(cacheKey);

    try {
      const deleted = await this.redis.del(fullKey);
      console.debug(`[Cache] INVALIDATE: ${cacheKey} (deleted: ${deleted > 0})`);
    } catch (err) {
      console.error(`[Cache] Invalidate error for ${cacheKey}:`, err);
    }
  }

  /**
   * Invalidate multiple cache entries by pattern.
   * Use with caution: scans all keys matching pattern.
   */
  async invalidatePattern(pattern: string): Promise<number> {
    const fullPattern = this.key(pattern);

    try {
      const keys = await this.redis.keys(fullPattern);
      if (keys.length === 0) return 0;

      const deleted = await this.redis.del(...keys);
      console.debug(`[Cache] INVALIDATE PATTERN: ${pattern} (deleted: ${deleted})`);
      return deleted;
    } catch (err) {
      console.error(`[Cache] Invalidate pattern error for ${pattern}:`, err);
      return 0;
    }
  }

  /**
   * Clear all cache entries (use sparingly, dangerous!).
   */
  async clear(): Promise<number> {
    try {
      const keys = await this.redis.keys(`${this.namespace}:*`);
      if (keys.length === 0) return 0;

      const deleted = await this.redis.del(...keys);
      console.warn(`[Cache] CLEARED ALL: ${deleted} entries`);
      return deleted;
    } catch (err) {
      console.error('[Cache] Clear error:', err);
      return 0;
    }
  }

  /**
   * Get cache statistics.
   */
  async stats(): Promise<{ keys: number; memory?: string }> {
    try {
      const keys = await this.redis.keys(`${this.namespace}:*`);
      const info = await this.redis.info('memory');

      let memory: string | undefined;
      if (info) {
        const match = info.match(/used_memory_human:(.+)\r/);
        if (match) memory = match[1];
      }

      return {
        keys: keys.length,
        memory,
      };
    } catch (err) {
      console.error('[Cache] Stats error:', err);
      return { keys: 0 };
    }
  }
}

// Singleton instance
let cacheServiceInstance: CacheService | null = null;

export function getCacheService(redis: any): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService(redis);
  }
  return cacheServiceInstance;
}
