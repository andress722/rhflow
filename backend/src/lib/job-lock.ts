import { redis } from './redis';

export class JobLock {
  /**
   * Tries to acquire a lock for a job name with a specified TTL in milliseconds.
   * Returns true if lock was acquired, false otherwise.
   */
  static async acquire(jobName: string, ttlMs: number = 300000): Promise<boolean> {
    try {
      if (redis.status !== 'ready') {
        await redis.connect().catch(() => {});
      }
      const lockKey = `lock:job:${jobName}`;
      // Set key if not exists (NX) with expiry (PX)
      const res = await redis.set(lockKey, 'locked', 'NX' as any, 'PX' as any, ttlMs);
      return res === 'OK';
    } catch (err) {
      console.error(`Failed to acquire lock for job: ${jobName}`, err);
      // Fallback to true to avoid blocking jobs entirely if Redis has a temporary network issue
      return true;
    }
  }

  /**
   * Releases a lock for a job name.
   */
  static async release(jobName: string): Promise<void> {
    try {
      const lockKey = `lock:job:${jobName}`;
      await redis.del(lockKey);
    } catch (err) {
      console.error(`Failed to release lock for job: ${jobName}`, err);
    }
  }
}
