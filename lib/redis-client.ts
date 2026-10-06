/**
 * Redis Client Initialization
 *
 * Creates and manages a Redis connection for caching.
 * Uses REDIS_URL environment variable (Upstash, Redis Cloud, or local Redis).
 *
 * Environment Variables:
 *  REDIS_URL: Connection URL (e.g., redis://localhost:6379 or rediss://user:pass@host:port)
 *
 * In development without Redis: graceful degradation (console logging instead)
 */

let redisClient: any = null;
let redisInitPromise: Promise<any> | null = null;

/**
 * Get or initialize Redis client.
 * Returns null if Redis is not configured (graceful degradation).
 */
export async function getRedisClient(): Promise<any | null> {
  if (redisClient !== null) {
    return redisClient;
  }

  if (redisInitPromise) {
    return await redisInitPromise;
  }

  redisInitPromise = initializeRedis();
  redisClient = await redisInitPromise;
  return redisClient;
}

async function initializeRedis(): Promise<any | null> {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn(
      '[Redis] REDIS_URL not configured. Caching disabled. Set REDIS_URL for production.'
    );
    return null;
  }

  try {
    // Dynamically import ioredis only if Redis is configured
    const Redis = (await import('ioredis')).default;

    const client = new Redis(redisUrl, {
      // Connection options
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: null, // For blocking commands
      enableReadyCheck: false,
      enableOfflineQueue: false,

      // Timeouts
      connectTimeout: 10000,
      commandTimeout: 5000,

      // Monitoring
      lazyConnect: false,
    });

    // Event handlers
    client.on('connect', () => {
      console.info('[Redis] Connected');
    });

    client.on('error', (err: Error) => {
      console.error('[Redis] Error:', err.message);
    });

    client.on('close', () => {
      console.warn('[Redis] Connection closed');
    });

    // Test connection
    await client.ping();
    console.info('[Redis] Connection verified (PING successful)');

    return client;
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Redis] Failed to initialize:', err);
      throw err; // Fail hard in production
    } else {
      console.warn('[Redis] Failed to initialize (dev/test mode):', err);
      return null; // Graceful degradation in dev
    }
  }
}

/**
 * Close Redis connection gracefully.
 * Call during server shutdown.
 */
export async function closeRedis(): Promise<void> {
  if (!redisClient) return;

  try {
    await redisClient.quit();
    console.info('[Redis] Connection closed gracefully');
    redisClient = null;
  } catch (err) {
    console.error('[Redis] Error closing connection:', err);
    redisClient = null;
  }
}

/**
 * Mock Redis client for when Redis is not available.
 * In-memory fallback (NOT for production!).
 */
export class MockRedisClient {
  private store: Map<string, { value: string; expiresAt: number }> = new Map();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: string): Promise<string> {
    this.store.set(key, { value, expiresAt: Date.now() + 24 * 60 * 60 * 1000 }); // 24h default
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    this.store.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.delete(key)) deleted++;
    }
    return deleted;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(
      `^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`
    );
    return Array.from(this.store.keys()).filter((key) => regex.test(key));
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async quit(): Promise<string> {
    this.store.clear();
    return 'OK';
  }

  async info(section?: string): Promise<string | null> {
    return null;
  }
}
