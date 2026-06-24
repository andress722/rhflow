import Redis from 'ioredis';
import { config } from '../config';

// Create ioredis client
export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true, // we will explicitly connect, or let healthcheck/fastify handle connection
});

// Log redis connection events
redis.on('connect', () => {
  // eslint-disable-next-line no-console
  console.log('Redis connected successfully.');
});

redis.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Redis connection error:', err);
});
