import { vi, describe, it, expect, beforeEach } from 'vitest';
import childProcess from 'child_process';
import { prisma } from '../src/lib/prisma';

describe('PresençaFlow RH - Scale Seed & Cleanup Safety Checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should verify that seed-scale.ts script blocks execution in production environment without flag', async () => {
    // Run seed scale script with NODE_ENV=production in a subprocess
    const env = { ...process.env, NODE_ENV: 'production' };
    delete env.ALLOW_SCALE_SEED;

    try {
      childProcess.execSync('npx ts-node scripts/seed-scale.ts --companies 1 --employees 1', {
        cwd: 'E:/RHFLOW/rhflow/backend',
        env,
        stdio: 'pipe',
      });
      // Should not succeed
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.status).toBe(1);
      expect(err.stderr.toString()).toContain('Seeding scale data is blocked in production');
    }
  }, 20000);

  it('should verify that cleanup-scale-seed.ts blocks execution in production environment without flag', async () => {
    const env = { ...process.env, NODE_ENV: 'production' };
    delete env.ALLOW_SCALE_SEED;

    try {
      childProcess.execSync('npx ts-node scripts/cleanup-scale-seed.ts --confirm', {
        cwd: 'E:/RHFLOW/rhflow/backend',
        env,
        stdio: 'pipe',
      });
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.status).toBe(1);
      expect(err.stderr.toString()).toContain('Cleanup of scale seed data is blocked in production');
    }
  }, 20000);

  it('should verify that cleanup-scale-seed.ts requires --confirm argument', async () => {
    const env = { ...process.env, NODE_ENV: 'development' };
    try {
      childProcess.execSync('npx ts-node scripts/cleanup-scale-seed.ts', {
        cwd: 'E:/RHFLOW/rhflow/backend',
        env,
        stdio: 'pipe',
      });
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.status).toBe(1);
      expect(err.stderr.toString()).toContain('You must provide the --confirm argument');
    }
  }, 20000);
});
