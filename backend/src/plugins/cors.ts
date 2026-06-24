import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { env } from '../config/env';

export default fp(async (fastify) => {
  const isProduction = env.NODE_ENV === 'production';

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // In non-production, allow all origins
      if (!isProduction) {
        cb(null, true);
        return;
      }

      // If no origin is provided (e.g. server-to-server, scripts), let it pass
      if (!origin) {
        cb(null, true);
        return;
      }

      // Allow only production client domains
      if (origin === 'https://presencaflow.com.br' || origin === 'https://www.presencaflow.com.br') {
        cb(null, true);
        return;
      }

      // Reject all other origins
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });
});
