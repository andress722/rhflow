import { redis } from './redis';
import crypto from 'crypto';

export class JobLock {
  // Map of active tokens held by this local process instance
  private static activeLocks = new Map<string, string>();

  /**
   * Tries to acquire a lock for a job name with a specified TTL in milliseconds.
   * Returns true if lock was acquired, false otherwise.
   * Uses unique UUID tokens as ownership identifiers.
   */
  static async acquire(jobName: string, ttlMs: number = 300000): Promise<boolean> {
    try {
      if (redis.status !== 'ready') {
        await redis.connect().catch(() => {});
      }
      const lockKey = `lock:job:${jobName}`;
      const token = crypto.randomUUID();

      // Set key if not exists (NX) with expiry in milliseconds (PX)
      const res = await redis.set(lockKey, token, 'PX', ttlMs, 'NX');
      if (res === 'OK') {
        this.activeLocks.set(jobName, token);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Failed to acquire lock for job: ${jobName}`, err);
      // Fallback to true to avoid blocking jobs entirely if Redis has a temporary network issue
      return true;
    }
  }

  /**
   * Releases a lock for a job name.
   * Uses an atomic Lua script to compare-and-delete, ensuring we only delete the lock
   * if we are the current owner (preventing deleting other workers' locks).
   */
  static async release(jobName: string): Promise<void> {
    try {
      const token = this.activeLocks.get(jobName);
      if (!token) return;

      this.activeLocks.delete(jobName);
      const lockKey = `lock:job:${jobName}`;

      // Lua script to atomically compare the lock token and delete the key if it matches
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      await redis.eval(luaScript, 1, lockKey, token);
    } catch (err) {
      console.error(`Failed to release lock for job: ${jobName}`, err);
    }
  }

  /**
   * Gets the active lock token stored in memory for this process.
   * Useful for testing purposes.
   */
  static getActiveToken(jobName: string): string | undefined {
    return this.activeLocks.get(jobName);
  }
}
