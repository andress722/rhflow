import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

// 1. Mock Prisma and Redis
vi.mock('../src/lib/prisma', () => {
  const mockPrisma = {
    $transaction: vi.fn((cb) => cb(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    companySettings: {
      findUnique: vi.fn(),
    },
    companySubscription: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    employee: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    workSchedule: {
      count: vi.fn(),
    },
    whatsAppChannel: {
      findUnique: vi.fn(),
    },
    remoteCheckin: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    auditLog: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    occurrence: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    medicalCertificate: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    whatsAppMessageLog: {
      count: vi.fn(),
    },
    operationalErrorLog: {
      count: vi.fn(),
      create: vi.fn(),
    },
    pilotLead: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    jobRun: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    pilotFeedback: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
    },
    pilotBacklogItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    knowledgeArticle: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    }
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

import { prisma } from '../src/lib/prisma';
import { buildApp } from '../src/app';

const app = buildApp();

describe('PresençaFlow RH - Knowledge Base API', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(prisma.user.findUnique).mockImplementation((args: any) => {
      const id = args.where.id;
      let role = 'ADMIN';
      if (id.includes('SUPER_ADMIN')) role = 'SUPER_ADMIN';
      if (id.includes('MANAGER')) role = 'MANAGER';
      if (id.includes('HR')) role = 'HR';
      return Promise.resolve({
        id,
        isActive: true,
        role,
        companyId: 'company-1',
        email: `${role.toLowerCase()}@test.com`,
      } as any);
    });

    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      id: 'company-1',
      name: 'Smoke Company',
      cnpj: '12345678901234',
      isActive: true,
    } as any);

    vi.mocked(prisma.pilotFeedback.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.pilotBacklogItem.count).mockResolvedValue(0);
  });

  const getAuthHeader = (role: string, companyId = 'company-1', userId = 'user-1') => {
    const userIdWithRole = `${userId}-${role}`;
    const token = app.jwt.sign({
      sub: userIdWithRole,
      companyId,
      role,
      email: `${role.toLowerCase()}@test.com`,
    });
    return { Authorization: `Bearer ${token}` };
  };

  describe('1. RBAC and Article Creation', () => {
    it('should block non-SUPER_ADMIN users from managing articles', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/knowledge/articles',
        headers: getAuthHeader('HR'),
        payload: {
          title: 'Como importar',
          summary: 'Resumo',
          contentMarkdown: 'Markdown',
          category: 'ONBOARDING',
          audience: 'ADMIN_HR',
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('should allow SUPER_ADMIN to create a published article and verify AuditLog', async () => {
      vi.mocked(prisma.knowledgeArticle.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.knowledgeArticle.create).mockResolvedValue({
        id: 'article-1',
        title: 'Como configurar jornadas',
        slug: 'como-configurar-jornadas',
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/knowledge/articles',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: {
          title: 'Como configurar jornadas',
          summary: 'Guia de jornadas',
          contentMarkdown: 'Conteúdo do artigo',
          category: 'ONBOARDING',
          audience: 'ADMIN_HR',
          status: 'PUBLISHED',
        },
      });

      expect(res.statusCode).toBe(201);
      const createCall = vi.mocked(prisma.knowledgeArticle.create).mock.calls[0][0];
      expect(createCall.data.slug).toBe('como-configurar-jornadas');
      expect(createCall.data.publishedAt).toBeInstanceOf(Date);

      // AuditLog created
      const auditLogCall = vi.mocked(prisma.auditLog.create).mock.calls[0][0];
      expect(auditLogCall.data.action).toBe('KNOWLEDGE_ARTICLE_CREATED');
    });
  });

  describe('2. Sanitization, CPF Masking, and Slug Uniqueness', () => {
    it('should strip scripts from Markdown content and mask CPFs in title/summary', async () => {
      vi.mocked(prisma.knowledgeArticle.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.knowledgeArticle.create).mockResolvedValue({ id: 'article-2' } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/knowledge/articles',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: {
          title: '<h1>FAQ do Piloto</h1>',
          summary: 'Perguntas com CPF 123.456.789-00',
          contentMarkdown: 'Texto <script>alert("hack")</script> aqui.',
          category: 'FAQ',
          audience: 'PUBLIC',
        },
      });

      expect(res.statusCode).toBe(201);

      const createCall = vi.mocked(prisma.knowledgeArticle.create).mock.calls[0][0];
      expect(createCall.data.title).toBe('FAQ do Piloto');
      expect(createCall.data.summary).toContain('***.***.***-**');
      expect(createCall.data.contentMarkdown).not.toContain('<script>');
    });

    it('should reject creation if slug already exists', async () => {
      vi.mocked(prisma.knowledgeArticle.findUnique).mockResolvedValue({ id: 'existing' } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/knowledge/articles',
        headers: getAuthHeader('SUPER_ADMIN'),
        payload: {
          title: 'Como configurar jornadas',
          summary: 'Guia de jornadas',
          contentMarkdown: 'Conteúdo',
          category: 'ONBOARDING',
          audience: 'ADMIN_HR',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error.message).toContain('slug');
    });
  });

  describe('3. Corporate Visibility & Audience Checks', () => {
    it('should show only PUBLISHED articles and respect user audience levels', async () => {
      // Mock article list
      vi.mocked(prisma.knowledgeArticle.findMany).mockResolvedValue([
        {
          id: '1',
          title: 'Manual de RH',
          slug: 'manual-de-rh',
          audience: 'ADMIN_HR',
          status: 'PUBLISHED',
        },
        {
          id: '2',
          title: 'Manual do Colaborador',
          slug: 'manual-colaborador',
          audience: 'EMPLOYEE',
          status: 'PUBLISHED',
        }
      ] as any);

      // HR reading list (has access to ADMIN_HR, EMPLOYEE, PUBLIC)
      const resHR = await app.inject({
        method: 'GET',
        url: '/api/knowledge/articles',
        headers: getAuthHeader('HR'),
      });
      expect(resHR.statusCode).toBe(200);

      const findManyHR = vi.mocked(prisma.knowledgeArticle.findMany).mock.calls[0][0];
      expect(findManyHR.where.audience.in).toContain('ADMIN_HR');

      // MANAGER reading list (only MANAGER, EMPLOYEE, PUBLIC)
      const resMgr = await app.inject({
        method: 'GET',
        url: '/api/knowledge/articles',
        headers: getAuthHeader('MANAGER'),
      });
      expect(resMgr.statusCode).toBe(200);

      const findManyMgr = vi.mocked(prisma.knowledgeArticle.findMany).mock.calls[1][0];
      expect(findManyMgr.where.audience.in).not.toContain('ADMIN_HR');
    });

    it('should block reading a specific article if user does not belong to the audience', async () => {
      vi.mocked(prisma.knowledgeArticle.findUnique).mockResolvedValue({
        id: '1',
        title: 'Manual de RH',
        slug: 'manual-de-rh',
        audience: 'ADMIN_HR',
        status: 'PUBLISHED',
      } as any);

      // MANAGER trying to read ADMIN_HR article
      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge/articles/manual-de-rh',
        headers: getAuthHeader('MANAGER'),
      });

      expect(res.statusCode).toBe(403);
    });

    it('should block reading draft or archived articles', async () => {
      vi.mocked(prisma.knowledgeArticle.findUnique).mockResolvedValue({
        id: '2',
        title: 'Draft',
        slug: 'draft-item',
        audience: 'PUBLIC',
        status: 'DRAFT',
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge/articles/draft-item',
        headers: getAuthHeader('HR'),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('4. Virtual Archiving (Archived Status)', () => {
    it('should set status to ARCHIVED upon deletion and log audit', async () => {
      vi.mocked(prisma.knowledgeArticle.findUnique).mockResolvedValue({
        id: 'article-1',
        title: 'Stale Guide',
        status: 'PUBLISHED',
      } as any);

      vi.mocked(prisma.knowledgeArticle.update).mockResolvedValue({
        id: 'article-1',
        status: 'ARCHIVED',
      } as any);

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/admin/knowledge/articles/article-1',
        headers: getAuthHeader('SUPER_ADMIN'),
      });

      expect(res.statusCode).toBe(200);

      const updateCall = vi.mocked(prisma.knowledgeArticle.update).mock.calls[0][0];
      expect(updateCall.data.status).toBe('ARCHIVED');

      // AuditLog created
      const auditLogCall = vi.mocked(prisma.auditLog.create).mock.calls[0][0];
      expect(auditLogCall.data.action).toBe('KNOWLEDGE_ARTICLE_ARCHIVED');
    });
  });

  describe('5. Seed Script validation', () => {
    it('should successfully run the seed function and trigger upsert calls', async () => {
      const { seedKnowledgeArticles } = await import('../src/seeds/knowledge-seed');
      
      vi.mocked(prisma.knowledgeArticle.upsert).mockResolvedValue({ id: 'mocked-id' } as any);

      await expect(seedKnowledgeArticles()).resolves.not.toThrow();
      expect(prisma.knowledgeArticle.upsert).toHaveBeenCalled();
    });
  });
});
