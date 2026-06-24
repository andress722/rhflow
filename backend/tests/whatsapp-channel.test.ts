import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

// 1. Mock Prisma and Redis
vi.mock('../src/lib/prisma', () => {
  const mockPrisma = {
    $transaction: vi.fn((cb) => cb(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    companySubscription: {
      findUnique: vi.fn(),
    },
    plan: {
      findUnique: vi.fn(),
    },
    companySettings: {
      findUnique: vi.fn(),
    },
    employee: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    remoteCheckin: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    occurrence: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    occurrenceEvent: {
      create: vi.fn(),
    },
    whatsAppChannel: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    whatsAppMessageLog: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

vi.mock('../src/lib/redis', () => {
  return {
    redis: {
      quit: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
    },
  };
});

// Set environment secret for tests
process.env.ENCRYPTION_SECRET = 'test-encryption-secret-must-be-32-chars-long';

import { prisma } from '../src/lib/prisma';
import { buildApp } from '../src/app';
import { encryptToken, decryptToken, maskSecret, sanitizeProviderConfig } from '../src/services/whatsapp-channel.service';
import crypto from 'crypto';

const app = buildApp();

describe('PresençaFlow RH - WhatsApp Channel settings and webhook', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getAuthHeader = (role: string, companyId = 'company-a', userId = 'user-1') => {
    const token = app.jwt.sign({
      sub: userId,
      companyId,
      role,
      email: `${role.toLowerCase()}@test.com`,
    });
    return { Authorization: `Bearer ${token}` };
  };

  describe('Encryption Helpers', () => {
    it('should encrypt and decrypt access token correctly using aes-256-gcm', () => {
      const originalToken = 'EAAGy6N4B...my-test-token-value';
      const encrypted = encryptToken(originalToken);
      expect(encrypted).not.toBe(originalToken);
      expect(encrypted.split(':').length).toBe(3); // ivHex:authTagHex:ciphertextHex

      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(originalToken);
    });

    it('should mask webhook secrets correctly', () => {
      expect(maskSecret(null)).toBeNull();
      expect(maskSecret('short')).toBe('sec_***');
      expect(maskSecret('secret_webhook_12345')).toBe('secr***2345');
    });

    it('should sanitize providerConfig from sensitive keys', () => {
      // META_CLOUD provider
      const configMeta = {
        phoneNumberId: '123456',
        businessAccountId: '8888',
        accessToken: 'sensitive_token',
        apiVersion: 'v18.0',
      };
      const cleanMeta = sanitizeProviderConfig(configMeta, 'META_CLOUD');
      expect(cleanMeta.phoneNumberId).toBe('123456');
      expect(cleanMeta.accessToken).toBeUndefined();
      expect(Object.keys(cleanMeta)).toEqual(['phoneNumberId', 'businessAccountId', 'apiVersion']);

      // SIMULATED provider
      const configSim = {
        displayName: 'My Test Bot',
        webhookSecret: 'sensitive_secret',
        password: 'pass',
      };
      const cleanSim = sanitizeProviderConfig(configSim, 'SIMULATED');
      expect(cleanSim.displayName).toBe('My Test Bot');
      expect(cleanSim.webhookSecret).toBeUndefined();
      expect(cleanSim.password).toBeUndefined();
    });
  });

  describe('API Endpoints - Settings / Logs', () => {
    it('should return simulated channel config (creating if not exist) and mask secrets', async () => {
      vi.mocked(prisma.whatsAppChannel.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.whatsAppChannel.create).mockResolvedValue({
        id: 'chan-1',
        companyId: 'company-a',
        provider: 'SIMULATED',
        status: 'SIMULATION',
        channelKey: 'key-1234',
        phoneNumber: null,
        displayName: null,
        webhookSecret: 'my_super_secret_code_12345',
        accessTokenEnc: null,
        providerConfig: {},
        lastInboundAt: null,
        lastOutboundAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/whatsapp-channel',
        headers: getAuthHeader('ADMIN', 'company-a'),
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload).data;
      expect(data.id).toBe('chan-1');
      expect(data.provider).toBe('SIMULATED');
      expect(data.webhookSecretMasked).toBe('my_s***2345');
      expect(data.hasToken).toBe(false);
      expect(data.accessTokenEnc).toBeUndefined();
    });

    it('should encrypt accessToken in PATCH, sanitize providerConfig and not return raw token', async () => {
      vi.mocked(prisma.whatsAppChannel.findUnique).mockResolvedValue({ id: 'chan-1', provider: 'META_CLOUD' } as any);
      vi.mocked(prisma.whatsAppChannel.update).mockResolvedValue({
        id: 'chan-1',
        companyId: 'company-a',
        provider: 'META_CLOUD',
        status: 'DISCONNECTED',
        channelKey: 'key-1234',
        phoneNumber: '5511999998888',
        displayName: 'Meta Bot',
        webhookSecret: 'sec_1234567890',
        accessTokenEnc: 'some_encrypted_gcm_token',
        providerConfig: { phoneNumberId: '999' },
      } as any);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/whatsapp-channel',
        headers: getAuthHeader('ADMIN', 'company-a'),
        payload: {
          provider: 'META_CLOUD',
          phoneNumber: '5511999998888',
          accessToken: 'my-meta-cloud-token',
          providerConfig: {
            phoneNumberId: '999',
            accessToken: 'sensitive_inside_config',
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload).data;
      expect(data.hasToken).toBe(true);
      expect(data.accessToken).toBeUndefined();
      expect(data.accessTokenEnc).toBeUndefined();
      expect(data.providerConfig.accessToken).toBeUndefined();
      
      const lastUpdateArgs = vi.mocked(prisma.whatsAppChannel.update).mock.calls[0][0];
      expect(lastUpdateArgs.data.accessTokenEnc).not.toBeNull();
      expect(lastUpdateArgs.data.accessTokenEnc).not.toBe('my-meta-cloud-token');
    });

    it('should block MANAGER and VIEWER roles from accessing settings / logs', async () => {
      const resSettings = await app.inject({
        method: 'GET',
        url: '/api/whatsapp-channel',
        headers: getAuthHeader('MANAGER', 'company-a'),
      });
      expect(resSettings.statusCode).toBe(403);

      const resLogs = await app.inject({
        method: 'GET',
        url: '/api/whatsapp-channel/logs',
        headers: getAuthHeader('VIEWER', 'company-a'),
      });
      expect(resLogs.statusCode).toBe(403);
    });

    it('should return paginated logs for ADMIN/HR role', async () => {
      vi.mocked(prisma.whatsAppMessageLog.findMany).mockResolvedValue([
        { id: 'log-1', body: 'Mensagem 1', direction: 'OUTBOUND', status: 'SIMULATED' },
      ] as any);
      vi.mocked(prisma.whatsAppMessageLog.count).mockResolvedValue(1);

      const res = await app.inject({
        method: 'GET',
        url: '/api/whatsapp-channel/logs?limit=10&page=1',
        headers: getAuthHeader('ADMIN', 'company-a'),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload).data;
      expect(body.logs.length).toBe(1);
      expect(body.pagination.total).toBe(1);
    });
  });

  describe('Inbound Webhooks', () => {
    it('should process GET challenge verification from Meta Webhook and return challenge value', async () => {
      vi.mocked(prisma.whatsAppChannel.findUnique).mockResolvedValue({
        id: 'chan-1',
        webhookSecret: 'my_verify_secret',
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/webhooks/whatsapp/channel-key-abc/inbound?hub.mode=subscribe&hub.verify_token=my_verify_secret&hub.challenge=challenge123',
      });

      expect(res.statusCode).toBe(200);
      expect(res.payload).toBe('challenge123');
    });

    it('should return 403 on GET challenge if secret/token does not match', async () => {
      vi.mocked(prisma.whatsAppChannel.findUnique).mockResolvedValue({
        id: 'chan-1',
        webhookSecret: 'my_verify_secret',
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/webhooks/whatsapp/channel-key-abc/inbound?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=challenge123',
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return 401 on POST webhook if HMAC SHA-256 signature check fails', async () => {
      vi.mocked(prisma.whatsAppChannel.findUnique).mockResolvedValue({
        id: 'chan-1',
        webhookSecret: 'my_webhook_secret_key',
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/whatsapp/channel-key-abc/inbound',
        headers: {
          'x-hub-signature-256': 'sha256=invalidSignatureValue',
        },
        payload: {
          from: '5511990000001',
          message: 'Hello World',
          timestamp: new Date().toISOString(),
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should accept POST webhook with correct HMAC signature, normalization and bypass body companyId', async () => {
      const webhookSecret = 'my_webhook_secret_key';
      const companyId = 'company-test-uuid-correct';
      vi.mocked(prisma.whatsAppChannel.findUnique).mockResolvedValue({
        id: 'chan-1',
        companyId,
        provider: 'SIMULATED',
        webhookSecret,
      } as any);

      vi.mocked(prisma.employee.findFirst).mockResolvedValue({
        id: 'emp-1',
        fullName: 'Test Inbound Employee',
        whatsapp: '5511990000001',
      } as any);

      vi.mocked(prisma.remoteCheckin.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.occurrence.create).mockResolvedValue({ id: 'occ-1', companyId } as any);

      const payloadObj = {
        from: '5511990000001',
        message: 'Sim, confirmado',
        timestamp: new Date().toISOString(),
      };

      const rawPayload = JSON.stringify(payloadObj);
      const signature = crypto.createHmac('sha256', webhookSecret).update(rawPayload).digest('hex');

      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/whatsapp/channel-key-abc/inbound',
        headers: {
          'x-hub-signature-256': `sha256=${signature}`,
          'Content-Type': 'application/json',
        },
        payload: rawPayload,
      });

      expect(res.statusCode).toBe(200); // Created occurrence status
      // Verify that companyId was extracted from channel, not the body (body has no companyId anyway!)
      const lastEmployeeFindArgs = vi.mocked(prisma.employee.findFirst).mock.calls[0][0];
      expect(lastEmployeeFindArgs.where.companyId).toBe(companyId);
    });
  });
});
