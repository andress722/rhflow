import { env } from './env';

export const config = {
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  redisUrl: env.REDIS_URL,
  jwtSecret: env.JWT_SECRET,
  env: env.NODE_ENV,
  encryptionSecret: env.ENCRYPTION_SECRET,
  frontendUrl: env.FRONTEND_URL,
  appBaseUrl: env.APP_BASE_URL,
  storagePath: env.STORAGE_PATH,
  internalJobSecret: env.INTERNAL_JOB_SECRET,
  whatsappLogRetentionDays: env.WHATSAPP_LOG_RETENTION_DAYS,
  auditLogRetentionDays: env.AUDIT_LOG_RETENTION_DAYS,
};
