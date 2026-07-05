import { redis } from './redis';
import { ImportJobService } from '../services/import-job.service';

let running = false;
let shouldStop = false;

/**
 * Background worker listening to Redis list to process import jobs sequentially.
 */
export async function startImportWorker() {
  if (running) return;
  running = true;
  shouldStop = false;
  
  console.log('[ImportWorker] Started listening for import jobs...');

  // Make sure redis is connected
  try {
    if (redis.status === 'wait') {
      await redis.connect();
    }
  } catch (err) {
    console.error('[ImportWorker] Failed to connect to Redis initially:', err);
  }

  while (!shouldStop) {
    try {
      // BRPOP returns [key, value] or null
      const result = await redis.brpop('rhflow:import:queue', 2);
      if (result && result.length === 2) {
        const jobId = result[1];
        console.log(`[ImportWorker] Processing job ID: ${jobId}`);
        await ImportJobService.processImportJob(jobId);
      }
    } catch (err: any) {
      // Avoid spamming logs if it is just a timeout
      if (err.message && err.message.includes('Connection is closed')) {
        console.warn('[ImportWorker] Redis connection lost, waiting to retry...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.error('[ImportWorker] Error in job queue processor loop:', err);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  running = false;
  console.log('[ImportWorker] Stopped.');
}

export function stopImportWorker() {
  shouldStop = true;
}
