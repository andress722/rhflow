import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load env from backend/.env (2 levels up from backend/src/config)
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// For Vitest tests, we want to make sure environment variables are populated
if (process.env.NODE_ENV === 'test') {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/presencaflow?schema=public';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-must-be-very-long-32-chars';
  process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'test-encryption-secret-must-be-32-chars-long';
  process.env.INTERNAL_JOB_SECRET = process.env.INTERNAL_JOB_SECRET || 'test-internal-job-secret-must-be-32-chars';
  process.env.SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@presencaflow.com';
  process.env.SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'superpassword123';
  process.env.COMMERCIAL_ALERT_EMAILS = process.env.COMMERCIAL_ALERT_EMAILS || 'admin@test.com,sales@test.com';
  process.env.COMMERCIAL_ALERT_WHATSAPP_NUMBERS = process.env.COMMERCIAL_ALERT_WHATSAPP_NUMBERS || '5511999999999';
  process.env.ENABLE_COMMERCIAL_EMAIL_ALERTS = process.env.ENABLE_COMMERCIAL_EMAIL_ALERTS || 'true';
  process.env.ENABLE_COMMERCIAL_WHATSAPP_ALERTS = process.env.ENABLE_COMMERCIAL_WHATSAPP_ALERTS || 'true';
  process.env.COMMERCIAL_DAILY_SUMMARY_TIME = process.env.COMMERCIAL_DAILY_SUMMARY_TIME || '18:00';
}

const envSchema = z.object({
  PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().url('DATABASE_URL deve ser uma URL válida'),
  REDIS_URL: z.string().url('REDIS_URL deve ser uma URL válida').default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET é obrigatório'),
  ENCRYPTION_SECRET: z.string().optional(),
  FRONTEND_URL: z.string().url('FRONTEND_URL deve ser uma URL válida').default('http://localhost:3000'),
  APP_BASE_URL: z.string().url('APP_BASE_URL deve ser uma URL válida').default('http://localhost:3001'),
  STORAGE_PATH: z.string().default(path.resolve(__dirname, '../../storage')),
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
  INTERNAL_JOB_SECRET: z.string().optional(),
  WHATSAPP_LOG_RETENTION_DAYS: z.coerce.number().int().min(30, 'WHATSAPP_LOG_RETENTION_DAYS deve ser no mínimo 30').default(180),
  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().min(180, 'AUDIT_LOG_RETENTION_DAYS deve ser no mínimo 180').default(365),
  SUPER_ADMIN_EMAIL: z.string().email('SUPER_ADMIN_EMAIL deve ser um e-mail válido').optional(),
  SUPER_ADMIN_PASSWORD: z.string().optional(),
  COMMERCIAL_ALERT_EMAILS: z.string().optional(),
  COMMERCIAL_ALERT_WHATSAPP_NUMBERS: z.string().optional(),
  ENABLE_COMMERCIAL_EMAIL_ALERTS: z.preprocess(val => val === 'true' || val === true, z.boolean()).default(false),
  ENABLE_COMMERCIAL_WHATSAPP_ALERTS: z.preprocess(val => val === 'true' || val === true, z.boolean()).default(false),
  COMMERCIAL_DAILY_SUMMARY_TIME: z.string().regex(/^\d{2}:\d{2}$/, 'COMMERCIAL_DAILY_SUMMARY_TIME deve estar no formato HH:mm').default('18:00'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_OAUTH_REDIRECT_URI: z.string().optional(),
  // Sprint 54 — Notification & Escalation Engine
  NOTIFICATION_ENGINE_ENABLED: z.preprocess(val => val === 'true' || val === true, z.boolean()).default(true),
  NOTIFICATION_ESCALATION_ENABLED: z.preprocess(val => val === 'true' || val === true, z.boolean()).default(false),
  NOTIFICATION_QUIET_HOURS_ENABLED: z.preprocess(val => val === 'true' || val === true, z.boolean()).default(true),
  NOTIFICATION_CHANNEL_FALLBACK_ENABLED: z.preprocess(val => val === 'true' || val === true, z.boolean()).default(true),
  NOTIFICATION_POLICY_BUILDER_ENABLED: z.preprocess(val => val === 'true' || val === true, z.boolean()).default(true),
  NOTIFICATION_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  NOTIFICATION_RETRY_BASE_DELAY_SECONDS: z.coerce.number().int().min(1).default(30),
  NOTIFICATION_RETRY_MAX_DELAY_MINUTES: z.coerce.number().int().min(1).default(15),
  NOTIFICATION_RECIPIENT_MAX_PER_HOUR: z.coerce.number().int().min(1).default(20),
  NOTIFICATION_EVENT_COOLDOWN_MINUTES: z.coerce.number().int().min(0).default(10),
  NOTIFICATION_DELIVERY_RETENTION_DAYS: z.coerce.number().int().min(1).default(90),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: z.preprocess(val => val === 'true' || val === true, z.boolean()).default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

export function validateEnv(processEnv: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.safeParse(processEnv);

  if (!parsed.success) {
    console.error('❌ Erro na validação das variáveis de ambiente no boot:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
    // Return empty configuration in case of mock exit bypass in tests
    return {} as any;
  }

  const validatedEnv = parsed.data;

  const isProdOrStaging = validatedEnv.NODE_ENV === 'production' || validatedEnv.NODE_ENV === 'staging';

  // Custom production security validation rules
  if (isProdOrStaging) {
    if (!processEnv.ENCRYPTION_SECRET) {
      console.error('❌ ERRO CRÍTICO: ENCRYPTION_SECRET é obrigatório em ambiente de produção/staging.');
      process.exit(1);
    }
    
    if (validatedEnv.JWT_SECRET.length < 32) {
      console.error('❌ ERRO CRÍTICO: JWT_SECRET em produção/staging deve ter no mínimo 32 caracteres para ser seguro.');
      process.exit(1);
    }

    if (!processEnv.INTERNAL_JOB_SECRET) {
      console.error('❌ ERRO CRÍTICO: INTERNAL_JOB_SECRET é obrigatório em ambiente de produção/staging.');
      process.exit(1);
    }

    if (!validatedEnv.INTERNAL_JOB_SECRET || validatedEnv.INTERNAL_JOB_SECRET.length < 32) {
      console.error('❌ ERRO CRÍTICO: INTERNAL_JOB_SECRET em produção/staging deve ter no mínimo 32 caracteres para ser seguro.');
      process.exit(1);
    }

    // SUPER_ADMIN rules for production/staging
    if (!processEnv.SUPER_ADMIN_EMAIL) {
      console.error('❌ ERRO CRÍTICO: SUPER_ADMIN_EMAIL é obrigatório em ambiente de produção/staging.');
      process.exit(1);
    }

    if (!processEnv.SUPER_ADMIN_PASSWORD) {
      console.error('❌ ERRO CRÍTICO: SUPER_ADMIN_PASSWORD é obrigatório em ambiente de produção/staging.');
      process.exit(1);
    }
  } else {
    // Setup defaults for dev/test environments if not specified
    if (!validatedEnv.INTERNAL_JOB_SECRET) {
      (validatedEnv as any).INTERNAL_JOB_SECRET = 'dev-internal-job-secret-key-default-32-chars';
    }

    // Set fallback local/demo SUPER_ADMIN credentials only in development/test
    if (!validatedEnv.SUPER_ADMIN_EMAIL) {
      (validatedEnv as any).SUPER_ADMIN_EMAIL = 'superadmin@presencaflow.com';
    }
    if (!validatedEnv.SUPER_ADMIN_PASSWORD) {
      (validatedEnv as any).SUPER_ADMIN_PASSWORD = 'superpassword123';
    }
  }

  // Validate SUPER_ADMIN_PASSWORD length (min 12 characters)
  if (validatedEnv.SUPER_ADMIN_PASSWORD && validatedEnv.SUPER_ADMIN_PASSWORD.length < 12) {
    console.error('❌ ERRO CRÍTICO: SUPER_ADMIN_PASSWORD deve ter no mínimo 12 caracteres.');
    process.exit(1);
  }

  // Commercial notifications validations
  if (validatedEnv.ENABLE_COMMERCIAL_EMAIL_ALERTS) {
    if (!processEnv.COMMERCIAL_ALERT_EMAILS || !processEnv.COMMERCIAL_ALERT_EMAILS.trim()) {
      console.error('❌ ERRO CRÍTICO: COMMERCIAL_ALERT_EMAILS é obrigatório quando ENABLE_COMMERCIAL_EMAIL_ALERTS é true.');
      process.exit(1);
    }
    const emails = processEnv.COMMERCIAL_ALERT_EMAILS.split(',').map(e => e.trim());
    const emailSchema = z.string().email();
    for (const email of emails) {
      const emailRes = emailSchema.safeParse(email);
      if (!emailRes.success) {
        console.error(`❌ ERRO CRÍTICO: O e-mail "${email}" em COMMERCIAL_ALERT_EMAILS é inválido.`);
        process.exit(1);
      }
    }
  }

  if (validatedEnv.ENABLE_COMMERCIAL_WHATSAPP_ALERTS) {
    if (!processEnv.COMMERCIAL_ALERT_WHATSAPP_NUMBERS || !processEnv.COMMERCIAL_ALERT_WHATSAPP_NUMBERS.trim()) {
      console.error('❌ ERRO CRÍTICO: COMMERCIAL_ALERT_WHATSAPP_NUMBERS é obrigatório quando ENABLE_COMMERCIAL_WHATSAPP_ALERTS é true.');
      process.exit(1);
    }
    const numbers = processEnv.COMMERCIAL_ALERT_WHATSAPP_NUMBERS.split(',').map(n => n.trim().replace(/\D/g, ''));
    for (const number of numbers) {
      if (number.length < 8) {
        console.error(`❌ ERRO CRÍTICO: O número de WhatsApp "${number}" em COMMERCIAL_ALERT_WHATSAPP_NUMBERS deve ser um número válido.`);
        process.exit(1);
      }
    }
  }

  return validatedEnv;
}

export const env = validateEnv(process.env);
