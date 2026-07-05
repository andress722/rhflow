import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { config } from '../config';
import { requireRole } from '../lib/auth-middleware';

const STATE_TTL_SECONDS = 600;
const STATE_KEY_PREFIX = 'calendar_oauth_state:';

type Provider = 'GOOGLE' | 'MICROSOFT';

function isValidProvider(value: string): value is Provider {
  return value === 'GOOGLE' || value === 'MICROSOFT';
}

function providerConfig(provider: Provider) {
  if (provider === 'GOOGLE') {
    return {
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientId: config.google.clientId || 'mock_google_id',
      clientSecret: config.google.clientSecret || 'mock_google_secret',
      redirectUri: config.google.redirectUri,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      extraAuthParams: { access_type: 'offline', prompt: 'consent' } as Record<string, string>,
    };
  }
  return {
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    clientId: config.microsoft.clientId || 'mock_ms_id',
    clientSecret: config.microsoft.clientSecret || 'mock_ms_secret',
    redirectUri: config.microsoft.redirectUri,
    scope: 'offline_access Calendars.ReadWrite',
    extraAuthParams: {} as Record<string, string>,
  };
}

/**
 * Real OAuth2 authorization-code flow for Google Calendar and Microsoft Graph.
 * The callback is intentionally NOT behind the authenticate hook: the browser
 * redirect coming back from the provider carries no Authorization header.
 * Tenant binding is instead carried by the one-time `state` value, which is
 * generated server-side (under an authenticated route) and stored in Redis
 * keyed to the companyId that started the flow.
 */
export default async function calendarOAuthRoutes(fastify: FastifyInstance) {
  fastify.get('/calendar/oauth/:provider/start', {
    preHandler: [fastify.authenticate, requireRole(['ADMIN', 'HR'])],
  }, async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const normalized = provider.toUpperCase();
    if (!isValidProvider(normalized)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_PROVIDER', message: 'Provedor de calendário inválido.' },
      });
    }

    const { companyId } = request.user;
    const cfg = providerConfig(normalized);

    const state = crypto.randomUUID();
    await redis.set(
      `${STATE_KEY_PREFIX}${state}`,
      JSON.stringify({ companyId, provider: normalized }),
      'EX',
      STATE_TTL_SECONDS,
    );

    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      response_type: 'code',
      scope: cfg.scope,
      state,
      ...cfg.extraAuthParams,
    });

    return reply.redirect(`${cfg.authorizeUrl}?${params.toString()}`);
  });

  fastify.get('/calendar/oauth/:provider/callback', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const normalized = provider.toUpperCase();
    const { code, state, error: providerError } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    const frontendBase = `${config.frontendUrl}/app/settings/company`;

    if (providerError) {
      return reply.redirect(`${frontendBase}?calendar=error&reason=denied`);
    }
    if (!isValidProvider(normalized) || !code || !state) {
      return reply.redirect(`${frontendBase}?calendar=error&reason=missing_params`);
    }

    const stateKey = `${STATE_KEY_PREFIX}${state}`;
    const storedRaw = await redis.get(stateKey);
    if (!storedRaw) {
      return reply.redirect(`${frontendBase}?calendar=error&reason=invalid_or_expired_state`);
    }
    // One-time use: delete immediately so the same state/code cannot be replayed.
    await redis.del(stateKey);

    let stored: { companyId: string; provider: string };
    try {
      stored = JSON.parse(storedRaw);
    } catch {
      return reply.redirect(`${frontendBase}?calendar=error&reason=corrupt_state`);
    }

    if (stored.provider !== normalized) {
      return reply.redirect(`${frontendBase}?calendar=error&reason=provider_mismatch`);
    }

    const cfg = providerConfig(normalized);

    try {
      const tokenRes = await fetch(cfg.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          code,
          redirect_uri: cfg.redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        return reply.redirect(`${frontendBase}?calendar=error&reason=token_exchange_failed`);
      }

      const data = (await tokenRes.json()) as any;
      const expiresIn = data.expires_in || 3600;

      await prisma.calendarIntegration.upsert({
        where: { companyId: stored.companyId },
        create: {
          companyId: stored.companyId,
          provider: normalized,
          accessToken: data.access_token,
          refreshToken: data.refresh_token || null,
          expiresAt: new Date(Date.now() + expiresIn * 1000),
          isActive: true,
        },
        update: {
          provider: normalized,
          accessToken: data.access_token,
          refreshToken: data.refresh_token || undefined,
          expiresAt: new Date(Date.now() + expiresIn * 1000),
          isActive: true,
        },
      });

      return reply.redirect(`${frontendBase}?calendar=connected`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Calendar OAuth callback failed', err);
      return reply.redirect(`${frontendBase}?calendar=error&reason=exception`);
    }
  });

  // POST /calendar/disconnect (revoke + deactivate). Upstream revoke is best-effort:
  // a provider failure must not prevent the tenant from disconnecting locally.
  fastify.post('/calendar/disconnect', {
    preHandler: [fastify.authenticate, requireRole(['ADMIN', 'HR'])],
  }, async (request, reply) => {
    const { companyId } = request.user;
    const integration = await prisma.calendarIntegration.findUnique({ where: { companyId } });
    if (!integration) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Nenhuma integração de calendário encontrada.' },
      });
    }

    if (integration.provider === 'GOOGLE' && integration.accessToken) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(integration.accessToken)}`, {
          method: 'POST',
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Google token revoke call failed (continuing with local disconnect)', err);
      }
    }

    await prisma.calendarIntegration.update({ where: { companyId }, data: { isActive: false } });

    return reply.status(200).send({ success: true, data: { disconnected: true } });
  });
}
