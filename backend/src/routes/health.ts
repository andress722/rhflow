import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { env } from '../config/env';
import fs from 'fs';
import path from 'path';

function checkStorageWritable(storagePath: string): boolean {
  try {
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }
    const tempFile = path.join(storagePath, `.health-${Date.now()}.tmp`);
    fs.writeFileSync(tempFile, 'ok');
    const content = fs.readFileSync(tempFile, 'utf8');
    fs.unlinkSync(tempFile);
    return content === 'ok';
  } catch (err) {
    return false;
  }
}

export default async function healthRoutes(fastify: FastifyInstance) {
  // Liveness Check: returns 200 if server is running
  fastify.get('/health/live', async (request, reply) => {
    return reply.status(200).send({
      success: true,
      status: 'OK',
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness Check: returns 200/503 validating database, storage path, encryption secret, and Redis
  fastify.get('/health/ready', async (request, reply) => {
    const checks = {
      db: false,
      redis: false,
      storage: false,
      encryptionSecret: false,
    };

    // Check DB
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.db = true;
    } catch (err) {
      fastify.log.error('Readiness check failed for Database');
    }

    // Check Redis
    try {
      if (redis.status !== 'ready') {
        await redis.connect();
      }
      const pingRes = await redis.ping();
      checks.redis = pingRes === 'PONG';
    } catch (err) {
      fastify.log.error('Readiness check failed for Redis');
    }

    // Check Storage Path
    try {
      checks.storage = checkStorageWritable(env.STORAGE_PATH);
    } catch (err) {
      fastify.log.error('Readiness check failed for Storage Path');
    }

    // Check Encryption Secret
    // Mandatory in production. In other envs, it must either exist or be a string if defined.
    if (env.NODE_ENV === 'production') {
      checks.encryptionSecret = !!env.ENCRYPTION_SECRET && env.ENCRYPTION_SECRET.length >= 32;
    } else {
      checks.encryptionSecret = true; // Allowed to run with fallback secret in dev/test
    }

    const allHealthy = checks.db && checks.redis && checks.storage && checks.encryptionSecret;

    if (!allHealthy) {
      return reply.status(503).send({
        success: false,
        status: 'UNHEALTHY',
        details: {
          db: checks.db ? 'OK' : 'FAIL',
          redis: checks.redis ? 'OK' : 'FAIL',
          storage: checks.storage ? 'OK' : 'FAIL',
          encryptionSecret: checks.encryptionSecret ? 'OK' : 'FAIL',
        },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.status(200).send({
      success: true,
      status: 'OK',
      details: {
        db: 'OK',
        redis: 'OK',
        storage: 'OK',
        encryptionSecret: 'OK',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // General Health Check
  fastify.get('/health', async (request, reply) => {
    let dbStatus = 'FAIL';
    let redisStatus = 'FAIL';

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'OK';
    } catch (err) {}

    try {
      if (redis.status !== 'ready') {
        await redis.connect();
      }
      const pingRes = await redis.ping();
      redisStatus = pingRes === 'PONG' ? 'OK' : 'FAIL';
    } catch (err) {}

    const isHealthy = dbStatus === 'OK' && redisStatus === 'OK';

    return reply.status(isHealthy ? 200 : 500).send({
      success: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      components: {
        db: dbStatus,
        redis: redisStatus,
      },
      timestamp: new Date().toISOString(),
    });
  });
}
