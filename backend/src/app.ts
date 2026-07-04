import Fastify from 'fastify';
import crypto from 'crypto';
import corsPlugin from './plugins/cors';
import jwtPlugin from './plugins/jwt';
import multipartPlugin from './plugins/multipart';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import workSchedulesRoutes from './routes/work-schedules';
import employeesRoutes from './routes/employees';
import occurrencesRoutes from './routes/occurrences';
import medicalCertificatesRoutes from './routes/medical-certificates';
import presenceRoutes from './routes/presence';
import webhooksRoutes from './routes/webhooks';
import automationsRoutes from './routes/automations';
import reportsRoutes from './routes/reports';
import companySettingsRoutes from './routes/company-settings';
import billingRoutes from './routes/billing';
import whatsappChannelRoutes from './routes/whatsapp-channel';
import internalJobsRoutes from './routes/internal-jobs';
import adminCompaniesRoutes from './routes/admin-companies';
import adminSupportRoutes from './routes/admin-support';
import onboardingRoutes from './routes/onboarding';
import pilotLeadsRoutes from './routes/pilot-leads';
import customerSuccessRoutes from './routes/customer-success';
import pilotConversionRoutes from './routes/pilot-conversion';
import manualBillingRoutes from './routes/manual-billing';
import retentionRoutes from './routes/retention';
import commandCenterRoutes from './routes/command-center';
import jobsAdminRoutes from './routes/jobs';
import adminFeedbackRoutes from './routes/admin-feedback';
import adminBacklogRoutes from './routes/admin-backlog';
import adminKnowledgeRoutes from './routes/admin-knowledge';
import publicKnowledgeRoutes from './routes/knowledge';
import adminAnalyticsRoutes from './routes/admin-analytics';
import telemetryRoutes from './routes/telemetry';
import notificationsRoutes from './routes/notifications';
import adminNotificationsRoutes from './routes/admin-notifications';
import executiveReportsRoutes from './routes/executive-reports';
import auditLogsRoutes from './routes/audit-logs';
import aiRoutes from './routes/ai';
import timesheetSignatureRoutes from './routes/timesheet-signature';
import pulseSurveysRoutes from './routes/pulse-surveys';
import developerPortalRoutes from './routes/developer-portal';
import activeSessionsRoutes from './routes/active-sessions';
import complianceRoutes from './routes/compliance';
import hourBankRoutes from './routes/hour-bank';
import leavesRoutes from './routes/leaves';
import calendarRoutes from './routes/calendar';
import employeePortalRoutes from './routes/employee-portal';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { env } from './config/env';

function sanitizeString(str: string): string {
  if (!str) return '';
  const sensitiveWords = [
    'authorization', 'cookie', 'jwt', 'accesstoken',
    'accesstokenenc', 'webhooksecret', 'password', 'cpf',
    'document', 'file', 'metadata', 'atestado'
  ];
  const lower = str.toLowerCase();
  for (const word of sensitiveWords) {
    if (lower.includes(word)) {
      return 'Ocorreu um erro de segurança ou validação contendo parâmetros confidenciais.';
    }
  }
  return str;
}

function sanitizeMetadata(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    const lower = val.toLowerCase();
    
    if (lower.startsWith('bearer ')) {
      return 'Bearer **********';
    }
    
    const digitsOnly = val.replace(/\D/g, '');
    if (digitsOnly.length === 11) {
      return '***.***.***-**';
    }
    
    const sensitiveWords = [
      'authorization', 'cookie', 'set-cookie', 'password', 'currentpassword',
      'newpassword', 'token', 'debugtoken', 'accesstoken', 'accesstokenenc',
      'webhooksecret', 'jwt', 'secret', 'cpf', 'document', 'file',
      'rawbody'
    ];
    for (const word of sensitiveWords) {
      if (lower.includes(word)) {
        return '[REDACTED]';
      }
    }
    
    const emailRegex = /^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/;
    if (emailRegex.test(val)) {
      const parts = val.split('@');
      const local = parts[0];
      const domain = parts[1];
      if (local.length > 2) {
        return `${local[0]}***${local[local.length - 1]}@${domain}`;
      }
      return `***@${domain}`;
    }
    
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(item => sanitizeMetadata(item));
  }
  if (typeof val === 'object') {
    const res: any = {};
    for (const key of Object.keys(val)) {
      const lowerKey = key.toLowerCase();
      const sensitiveKeys = [
        'authorization', 'cookie', 'set-cookie', 'password', 'currentpassword',
        'newpassword', 'token', 'debugtoken', 'accesstoken', 'accesstokenenc',
        'webhooksecret', 'jwt', 'secret', 'cpf', 'document', 'file',
        'rawbody', 'payload', 'body', 'tempPassword', 'confirmPassword'
      ];
      if (sensitiveKeys.some(k => lowerKey.includes(k))) {
        res[key] = '[REDACTED]';
      } else {
        res[key] = sanitizeMetadata(val[key]);
      }
    }
    return res;
  }
  return val;
}

function logOperationalErrorAsync(
  request: any,
  reply: any,
  errorCode: string,
  errorMessage: string,
  statusCode: number,
  errorStack?: string
) {
  // Execute asynchronously to not block the request
  (async () => {
    try {
      const requestId = request.requestId || reply.getHeader('x-request-id') || crypto.randomUUID();
      const route = request.routerPath || request.url || '';

      // Avoid health checks
      if (route.includes('/health') || route.includes('/live') || route.includes('/ready')) {
        return;
      }

      // Avoid generic 404
      if (statusCode === 404 && errorCode !== 'REQUEST_NOT_FOUND') {
        return;
      }

      // Filter relevant codes
      const relevantCodes = [
        'VALIDATION_ERROR',
        'FORBIDDEN',
        'MUST_CHANGE_PASSWORD',
        'PLAN_LIMIT_EXCEEDED',
        'PLAN_FEATURE_DISABLED',
        'FEATURE_DISABLED',
        'TOO_MANY_ATTEMPTS',
        'REQUEST_NOT_FOUND',
        'INTERNAL_SERVER_ERROR',
        'WEBHOOK_INVALID_SIGNATURE',
        'UPLOAD_INVALID_MIME',
        'CSV_IMPORT_FAILED'
      ];

      const isInvalidCredentials = errorCode === 'INVALID_CREDENTIALS';
      if (!relevantCodes.includes(errorCode) && !isInvalidCredentials) {
        return;
      }

      // Sample/throttle INVALID_CREDENTIALS to 10%
      if (isInvalidCredentials && Math.random() > 0.1) {
        return;
      }

      const user = request.user;
      const companyId = user?.companyId || (request.body as any)?.companyId || null;
      const userId = user?.sub || null;

      const rawMetadata: any = {
        headers: request.headers,
        query: request.query,
        params: request.params,
        body: request.body,
        method: request.method,
        route,
      };
      if (errorStack) {
        rawMetadata.stack = errorStack;
      }

      const sanitizedMeta = sanitizeMetadata(rawMetadata);

      if (!prisma.operationalErrorLog) {
        return;
      }

      await prisma.operationalErrorLog.create({
        data: {
          companyId,
          userId,
          requestId,
          route,
          method: request.method,
          errorCode,
          message: sanitizeString(errorMessage),
          statusCode,
          metadata: sanitizedMeta,
        },
      });
    } catch (err) {
      // Failure to write to operational log must never throw or create another log
      console.error('Failed to save operational error log:', err);
    }
  })();
}

export function buildApp() {
  const isTest = env.NODE_ENV === 'test';
  const app = Fastify({
    logger: isTest ? false : {
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // 1. Hook to assign/retrieve requestId and return it in the headers
  app.addHook('onRequest', async (request, reply) => {
    (request as any).startTime = Date.now();
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    (request as any).requestId = requestId;
    reply.header('x-request-id', requestId);
  });

  // 2. Hook to perform structured logging on response completion
  app.addHook('onResponse', async (request, reply) => {
    const durationMs = Date.now() - ((request as any).startTime || Date.now());
    const user = (request as any).user;
    
    const companyId = user?.companyId || null;
    const userId = user?.sub || null;
    const method = request.method;
    const route = request.routerPath || request.url;
    const statusCode = reply.statusCode;
    const errorCode = (reply as any).errorCode || null;
    const requestId = (request as any).requestId;

    const logData = {
      requestId,
      companyId,
      userId,
      method,
      route,
      statusCode,
      durationMs,
      errorCode,
    };

    if (statusCode >= 400) {
      app.log.error(logData, `HTTP Request failed`);
    } else {
      app.log.info(logData, `HTTP Request completed`);
    }
  });

  // 3. Custom Error Handler
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    const errorCode = (error as any).code || 'INTERNAL_SERVER_ERROR';
    (reply as any).errorCode = errorCode;

    const isProd = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
    const rawMessage = error.message || 'Erro interno do servidor';
    const message = sanitizeString(rawMessage);
    const requestId = (request as any).requestId || null;

    const payload: any = {
      success: false,
      error: {
        code: errorCode,
        message,
        requestId,
      },
    };

    if (!isProd) {
      payload.error.stack = error.stack;
    }

    // Log error sanitised
    const logData: any = {
      requestId,
      errorCode,
      statusCode,
      message,
    };
    if (!isProd && error.stack) {
      logData.stack = error.stack;
    }

    app.log.error(logData, `Error handler caught exception`);

    // Log to DB
    logOperationalErrorAsync(request, reply, errorCode, rawMessage, statusCode, error.stack);
    (reply as any).loggedToOperationalLog = true;

    return reply.status(statusCode).send(payload);
  });

  // 4. Hook to inject requestId into manual error responses and sanitize output in production/staging
  app.addHook('onSend', async (request, reply, payload) => {
    if (reply.statusCode >= 400 && typeof payload === 'string') {
      try {
        const data = JSON.parse(payload);
        if (data && data.success === false && data.error) {
          const isProd = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
          
          data.error.requestId = data.error.requestId || (request as any).requestId || null;
          
          if (isProd) {
            delete data.error.stack;
            delete data.error.details;
          }

          if (!(reply as any).loggedToOperationalLog) {
            const errorCode = data.error.code || 'INTERNAL_SERVER_ERROR';
            const errorMessage = data.error.message || '';
            logOperationalErrorAsync(request, reply, errorCode, errorMessage, reply.statusCode);
            (reply as any).loggedToOperationalLog = true;
          }
          
          return JSON.stringify(data);
        }
      } catch (e) {
        // Not a JSON payload or parsing failed
      }
    }
    return payload;
  });

  // Register plugins
  app.register(corsPlugin);
  app.register(jwtPlugin);
  app.register(multipartPlugin);

  // Register routes (with prefix /api)
  app.register(healthRoutes, { prefix: '/api' });
  app.register(authRoutes, { prefix: '/api' });
  app.register(usersRoutes, { prefix: '/api' });
  app.register(workSchedulesRoutes, { prefix: '/api' });
  app.register(employeesRoutes, { prefix: '/api' });
  app.register(occurrencesRoutes, { prefix: '/api' });
  app.register(medicalCertificatesRoutes, { prefix: '/api' });
  app.register(presenceRoutes, { prefix: '/api' });
  app.register(webhooksRoutes, { prefix: '/api' });
  app.register(automationsRoutes, { prefix: '/api' });
  app.register(reportsRoutes, { prefix: '/api' });
  app.register(companySettingsRoutes, { prefix: '/api' });
  app.register(billingRoutes, { prefix: '/api' });
  app.register(whatsappChannelRoutes, { prefix: '/api' });
  app.register(internalJobsRoutes, { prefix: '/api' });
  app.register(adminCompaniesRoutes, { prefix: '/api' });
  app.register(adminSupportRoutes, { prefix: '/api' });
  app.register(onboardingRoutes, { prefix: '/api' });
  app.register(pilotLeadsRoutes, { prefix: '/api' });
  app.register(customerSuccessRoutes, { prefix: '/api' });
  app.register(pilotConversionRoutes, { prefix: '/api' });
  app.register(manualBillingRoutes, { prefix: '/api' });
  app.register(retentionRoutes, { prefix: '/api' });
  app.register(commandCenterRoutes, { prefix: '/api' });
  app.register(jobsAdminRoutes, { prefix: '/api' });
  app.register(adminFeedbackRoutes, { prefix: '/api' });
  app.register(adminBacklogRoutes, { prefix: '/api' });
  app.register(adminKnowledgeRoutes, { prefix: '/api' });
  app.register(publicKnowledgeRoutes, { prefix: '/api' });
  app.register(adminAnalyticsRoutes, { prefix: '/api' });
  app.register(telemetryRoutes, { prefix: '/api' });
  app.register(notificationsRoutes, { prefix: '/api' });
  app.register(adminNotificationsRoutes, { prefix: '/api' });
  app.register(executiveReportsRoutes, { prefix: '/api' });
  app.register(auditLogsRoutes, { prefix: '/api' });
  app.register(aiRoutes, { prefix: '/api' });
  app.register(timesheetSignatureRoutes, { prefix: '/api' });
  app.register(pulseSurveysRoutes, { prefix: '/api' });
  app.register(developerPortalRoutes, { prefix: '/api' });
  app.register(activeSessionsRoutes, { prefix: '/api' });
  app.register(complianceRoutes, { prefix: '/api' });
  app.register(hourBankRoutes, { prefix: '/api' });
  app.register(leavesRoutes, { prefix: '/api' });
  app.register(calendarRoutes, { prefix: '/api' });
  app.register(employeePortalRoutes, { prefix: '/api' });

  if (env.NODE_ENV === 'test') {
    app.get('/api/test-error-leak', async () => {
      throw new Error('Leak: accessToken="super-secret-meta-token"');
    });
  }

  // Graceful shutdown hooks
  app.addHook('onClose', async () => {
    app.log.info('Closing Prisma and Redis client connections...');
    await prisma.$disconnect();
    await redis.quit();
  });

  return app;
}
