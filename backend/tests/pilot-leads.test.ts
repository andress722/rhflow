import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

// 1. Mock Prisma and Redis BEFORE importing the app
vi.mock('../src/lib/prisma', () => {
  const mockPrisma = {
    $transaction: vi.fn((cb) => cb(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    user: {
      findUnique: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
    pilotLead: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    leadActivity: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

vi.mock('../src/lib/redis', () => {
  return {
    redis: {
      status: 'ready',
      quit: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      incr: vi.fn(),
      expire: vi.fn(),
      del: vi.fn(),
    },
  };
});

import { prisma } from '../src/lib/prisma';
import { redis } from '../src/lib/redis';
import { buildApp } from '../src/app';

const app = buildApp();

describe('PresençaFlow RH - Pilot Leads API', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.incr).mockResolvedValue(1);

    // Default mock behaviors for admin auth check
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'superadmin-1',
      isActive: true,
      mustChangePassword: false,
    } as any);
    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      id: 'platform-company',
      isActive: true,
    } as any);
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

  describe('1. Public Endpoint - Creation and Validation', () => {
    it('should successfully create a new lead with valid data', async () => {
      const mockCreate = vi.mocked(prisma.pilotLead.create).mockResolvedValue({} as any);
      vi.mocked(prisma.pilotLead.findFirst).mockResolvedValue(null); // No duplicates

      const response = await app.inject({
        method: 'POST',
        url: '/api/public/pilot-leads',
        payload: {
          name: 'Jane Doe',
          companyName: 'Acme Corp',
          role: 'HR Manager',
          email: 'jane@acme.com',
          whatsapp: '(11) 99999-9999',
          employeeCount: 45,
          mainPain: 'Atestados',
          source: 'Site Principal',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Recebemos seu interesse');

      expect(mockCreate).toHaveBeenCalled();
      const callData = mockCreate.mock.calls[0][0].data;
      expect(callData.name).toBe('Jane Doe');
      expect(callData.email).toBe('jane@acme.com');
      expect(callData.whatsapp).toBe('11999999999'); // digits only normalized
    });

    it('should accept missing optional role and whatsapp fields', async () => {
      const mockCreate = vi.mocked(prisma.pilotLead.create).mockResolvedValue({} as any);
      vi.mocked(prisma.pilotLead.findFirst).mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/public/pilot-leads',
        payload: {
          name: 'John Doe',
          companyName: 'Global Inc',
          email: 'john@global.com',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockCreate).toHaveBeenCalled();
      const callData = mockCreate.mock.calls[0][0].data;
      expect(callData.role).toBeNull();
      expect(callData.whatsapp).toBeNull();
    });

    it('should reject invalid e-mail with 400 validation error', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/public/pilot-leads',
        payload: {
          name: 'John Doe',
          companyName: 'Global Inc',
          email: 'invalid-email-address',
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid employeeCount with 400 validation error', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/public/pilot-leads',
        payload: {
          name: 'John Doe',
          companyName: 'Global Inc',
          email: 'john@global.com',
          employeeCount: 200000, // max is 100000
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('1.5 Campaign Tracking, UTMs and Sanitization', () => {
    it('should successfully save UTM/campaign parameters to metadata JSON', async () => {
      const mockCreate = vi.mocked(prisma.pilotLead.create).mockResolvedValue({} as any);
      vi.mocked(prisma.pilotLead.findFirst).mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/public/pilot-leads',
        payload: {
          name: 'Jane Campaign',
          companyName: 'Campaign Inc',
          email: 'campaign@acme.com',
          utmSource: 'newsletter',
          utm_medium: 'email',
          utmCampaign: 'launch_2026',
          utmContent: 'sidebar_banner',
          utmTerm: 'hr automation',
          referrer: 'https://google.com/search?q=rh',
          landingPath: '/pilot',
          source: 'newsletter_campaign',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockCreate).toHaveBeenCalled();
      const callData = mockCreate.mock.calls[0][0].data;
      expect(callData.source).toBe('newsletter_campaign');
      expect(callData.metadata).toEqual({
        utmSource: 'newsletter',
        utmMedium: 'email',
        utmCampaign: 'launch_2026',
        utmContent: 'sidebar_banner',
        utmTerm: 'hr automation',
        referrer: 'https://google.com/search?q=rh',
        landingPath: '/pilot',
        source: 'newsletter_campaign',
      });
    });

    it('should sanitize and cut UTM/campaign strings exceeding length limits', async () => {
      const mockCreate = vi.mocked(prisma.pilotLead.create).mockResolvedValue({} as any);
      vi.mocked(prisma.pilotLead.findFirst).mockResolvedValue(null);

      const longUtm = 'a'.repeat(150); // Limit is 100
      const longReferrer = 'r'.repeat(1200); // Limit is 1024
      const longLandingPath = 'p'.repeat(600); // Limit is 512

      const response = await app.inject({
        method: 'POST',
        url: '/api/public/pilot-leads',
        payload: {
          name: 'Jane Cut',
          companyName: 'Cut Inc',
          email: 'cut@acme.com',
          utmSource: longUtm,
          referrer: longReferrer,
          landingPath: longLandingPath,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockCreate).toHaveBeenCalled();
      const callData = mockCreate.mock.calls[0][0].data;
      expect(callData.metadata.utmSource.length).toBe(100);
      expect(callData.metadata.referrer.length).toBe(1024);
      expect(callData.metadata.landingPath.length).toBe(512);
    });

    it('should sanitize script/HTML injection tags in campaign parameters', async () => {
      const mockCreate = vi.mocked(prisma.pilotLead.create).mockResolvedValue({} as any);
      vi.mocked(prisma.pilotLead.findFirst).mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/public/pilot-leads',
        payload: {
          name: 'Jane Clean',
          companyName: 'Clean Inc',
          email: 'clean@acme.com',
          utmSource: '<script>alert("hack")</script>google',
          referrer: 'https://google.com?q=<span style="color:red">test</span>',
          source: '<b>whatsapp</b>',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockCreate).toHaveBeenCalled();
      const callData = mockCreate.mock.calls[0][0].data;
      expect(callData.metadata.utmSource).toBe('alert("hack")google');
      expect(callData.metadata.referrer).toBe('https://google.com?q=test');
      expect(callData.source).toBe('whatsapp');
      expect(callData.metadata.source).toBe('whatsapp');
    });
  });

  describe('2. Anti-Spam (Honeypot & Deduplication)', () => {
    it('should skip DB creation and return success if honeypot field websiteUrl is filled', async () => {
      const mockCreate = vi.mocked(prisma.pilotLead.create);

      const response = await app.inject({
        method: 'POST',
        url: '/api/public/pilot-leads',
        payload: {
          name: 'Spam Bot',
          companyName: 'Spam Corp',
          email: 'spam@bot.com',
          websiteUrl: 'http://spammy-site.com', // Filled honeypot
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should skip DB creation and return success if e-mail has registered in the last 7 days', async () => {
      const mockCreate = vi.mocked(prisma.pilotLead.create);
      // Simulate existing lead found
      vi.mocked(prisma.pilotLead.findFirst).mockResolvedValue({
        id: 'lead-1',
        email: 'duplicate@test.com',
      } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/public/pilot-leads',
        payload: {
          name: 'Duplicate Lead',
          companyName: 'Same Company',
          email: 'duplicate@test.com',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('3. Rate Limiting', () => {
    it('should return 429 after 5 requests from the same IP', async () => {
      // Simulate Redis blocking for the rate limiting key
      vi.mocked(redis.get).mockResolvedValue('5'); // Limit reached

      const response = await app.inject({
        method: 'POST',
        url: '/api/public/pilot-leads',
        payload: {
          name: 'Spammy IP',
          companyName: 'Acme Corp',
          email: 'spam@acme.com',
        },
      });

      expect(response.statusCode).toBe(429);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('TOO_MANY_ATTEMPTS');
    });
  });

  describe('4. Administrative Dashboard Control', () => {
    it('should allow SUPER_ADMIN to list leads with pagination and filters', async () => {
      const mockFindMany = vi.mocked(prisma.pilotLead.findMany).mockResolvedValue([]);
      const mockCount = vi.mocked(prisma.pilotLead.count).mockResolvedValue(0);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/leads?status=NEW&search=Acme&limit=10&page=2',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            { status: 'NEW' },
            {
              OR: [
                { name: { contains: 'Acme', mode: 'insensitive' } },
                { companyName: { contains: 'Acme', mode: 'insensitive' } },
                { email: { contains: 'Acme', mode: 'insensitive' } },
              ],
            },
          ]),
        },
        take: 10,
        skip: 10,
      }));
      expect(mockCount).toHaveBeenCalled();
    });

    it('should filter leads by source, utmCampaign, and utmSource on the administrative list', async () => {
      const mockFindMany = vi.mocked(prisma.pilotLead.findMany).mockResolvedValue([]);
      vi.mocked(prisma.pilotLead.count).mockResolvedValue(0);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/leads?source=whatsapp&utmSource=newsletter&utmCampaign=launch_2026',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(response.statusCode).toBe(200);
      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { source: 'whatsapp' },
            {
              metadata: {
                path: ['utmSource'],
                equals: 'newsletter',
              },
            },
            {
              metadata: {
                path: ['utmCampaign'],
                equals: 'launch_2026',
              },
            },
          ]),
        }),
      }));
    });

    it('should block regular users from accessing admin leads routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/leads',
        headers: getAuthHeader('HR'),
      });

      expect(response.statusCode).toBe(403);
    });

    it('should allow SUPER_ADMIN to update status and notes, generating AuditLog', async () => {
      vi.mocked(prisma.pilotLead.findUnique).mockResolvedValue({
        id: 'lead-123',
        name: 'Jane Doe',
        status: 'NEW',
        notes: '',
      } as any);
      
      const mockUpdate = vi.mocked(prisma.pilotLead.update).mockResolvedValue({} as any);
      const mockAuditLog = vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/leads/lead-123',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: {
          status: 'CONTACTED',
          notes: 'Called. Interested in demo.',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'lead-123' },
        data: {
          status: 'CONTACTED',
          notes: 'Called. Interested in demo.',
        },
      }));
      expect(mockAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          action: 'LEAD_UPDATED',
          entity: 'PilotLead',
          entityId: 'lead-123',
          metadata: expect.objectContaining({
            previousStatus: 'NEW',
            newStatus: 'CONTACTED',
          }),
        }),
      }));
    });
  });
});
