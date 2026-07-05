import { buildApp } from './app';
import { config } from './config';
import { redis } from './lib/redis';
import { startImportWorker } from './lib/import-worker';

const app = buildApp();

async function start() {
  try {
    // Proactively connect to Redis
    try {
      await redis.connect();
    } catch (redisErr) {
      app.log.warn(redisErr, 'Could not connect to Redis at startup. Will retry on demand.');
    }

    // Start background worker for imports
    setImmediate(() => {
      startImportWorker().catch(err => {
        app.log.error(err, 'Failed to start import worker');
      });
    });

    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Server is running at http://localhost:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
