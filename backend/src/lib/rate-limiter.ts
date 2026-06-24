import { redis } from './redis';

const memoryStore = new Map<string, { count: number; expiresAt: number }>();

/**
 * RateLimiter for protection against login brute force.
 * Uses Redis if available, with a fallback in-memory cache for development/test/single instances.
 * Production environments running in multi-instance (load balanced) configurations MUST use Redis.
 */
export class RateLimiter {
  private static readonly LIMIT = 5;
  private static readonly WINDOW_SEC = 900; // 15 minutes

  /**
   * Checks if a key (email or IP) is blocked.
   */
  static async isBlocked(key: string): Promise<boolean> {
    const isRedisReady = redis.status === 'ready' || redis.status === 'connect';

    if (isRedisReady) {
      try {
        const countStr = await redis.get(key);
        if (countStr && parseInt(countStr, 10) >= this.LIMIT) {
          return true;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('RateLimiter redis check error, falling back to memory:', err);
      }
    }

    // In-memory fallback
    const now = Date.now();
    const record = memoryStore.get(key);
    if (record) {
      if (now > record.expiresAt) {
        memoryStore.delete(key);
        return false;
      }
      if (record.count >= this.LIMIT) {
        return true;
      }
    }

    return false;
  }

  /**
   * Increments the failure count for a key.
   */
  static async increment(key: string): Promise<void> {
    const isRedisReady = redis.status === 'ready' || redis.status === 'connect';

    if (isRedisReady) {
      try {
        const count = await redis.incr(key);
        if (count === 1) {
          await redis.expire(key, this.WINDOW_SEC);
        }
        return;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('RateLimiter redis increment error, falling back to memory:', err);
      }
    }

    // In-memory fallback
    const now = Date.now();
    const record = memoryStore.get(key);
    if (record && now <= record.expiresAt) {
      record.count += 1;
    } else {
      memoryStore.set(key, {
        count: 1,
        expiresAt: now + this.WINDOW_SEC * 1000,
      });
    }
  }

  /**
   * Resets the limiter for a key upon successful login.
   */
  static async reset(key: string): Promise<void> {
    const isRedisReady = redis.status === 'ready' || redis.status === 'connect';

    if (isRedisReady) {
      try {
        await redis.del(key);
        return;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('RateLimiter redis reset error, falling back to memory:', err);
      }
    }

    memoryStore.delete(key);
  }
}
