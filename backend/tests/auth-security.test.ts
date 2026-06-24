import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

// 1. Mock Prisma and Redis BEFORE importing the app
vi.mock('../src/lib/prisma', () => {
  const mockPrisma = {
    $transaction: vi.fn((cb) => cb(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    userInvite: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
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
import { hashPassword } from '../src/lib/crypto';
import { env } from '../src/config/env';

const app = buildApp();

describe('PresençaFlow RH - Auth Security & Password Management', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default Redis Mock to not block unless specific test overrides
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.incr).mockResolvedValue(1);
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

  describe('1. Login and mustChangePassword flag', () => {
    it('should return mustChangePassword flag on successful login', async () => {
      const storedHash = hashPassword('CorrectPassword123!');
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: 'user-1',
        name: 'John Doe',
        email: 'john@test.com',
        passwordHash: storedHash,
        role: 'HR',
        companyId: 'company-a',
        isActive: true,
        mustChangePassword: true,
        company: { id: 'company-a', isActive: true },
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'john@test.com',
          password: 'CorrectPassword123!',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.user.mustChangePassword).toBe(true);
      expect(json.data.token).toBeDefined();
    });
  });

  describe('2. Route Restrictions for mustChangePassword', () => {
    it('should block protected corporate routes with 403 MUST_CHANGE_PASSWORD if flag is active', async () => {
      // Mock db check inside jwt.ts decoration
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        isActive: true,
        mustChangePassword: true,
      } as any);

      vi.mocked(prisma.company.findUnique).mockResolvedValue({
        isActive: true,
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/users',
        headers: getAuthHeader('HR'),
      });

      expect(res.statusCode).toBe(403);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('MUST_CHANGE_PASSWORD');
    });

    it('should allow accessing auth/me and change-password even when mustChangePassword is true', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        name: 'John Doe',
        email: 'john@test.com',
        role: 'HR',
        companyId: 'company-a',
        isActive: true,
        mustChangePassword: true,
      } as any);

      vi.mocked(prisma.company.findUnique).mockResolvedValue({
        isActive: true,
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: getAuthHeader('HR'),
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('3. Change Password functionality', () => {
    it('should allow changing password when providing valid credentials and a strong password', async () => {
      const oldHash = hashPassword('OldTempPassword1!');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        passwordHash: oldHash,
        role: 'HR',
        companyId: 'company-a',
        isActive: true,
        mustChangePassword: true,
      } as any);

      vi.mocked(prisma.user.update).mockResolvedValue({
        id: 'user-1',
        name: 'John Doe',
        email: 'john@test.com',
        role: 'HR',
        companyId: 'company-a',
        mustChangePassword: false,
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: getAuthHeader('HR'),
        payload: {
          currentPassword: 'OldTempPassword1!',
          newPassword: 'StrongNewPassword2026!',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.user.mustChangePassword).toBe(false);
      expect(json.data.token).toBeDefined();
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should reject changing password if current password is wrong', async () => {
      const oldHash = hashPassword('OldTempPassword1!');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        passwordHash: oldHash,
        isActive: true,
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: getAuthHeader('HR'),
        payload: {
          currentPassword: 'WrongPassword!',
          newPassword: 'StrongNewPassword2026!',
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('INVALID_PASSWORD');
    });

    it('should reject changing password if the new password is weak', async () => {
      const oldHash = hashPassword('OldTempPassword1!');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        passwordHash: oldHash,
        isActive: true,
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: getAuthHeader('HR'),
        payload: {
          currentPassword: 'OldTempPassword1!',
          newPassword: 'weakpassword123',
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('WEAK_PASSWORD');
    });
  });

  describe('4. Forgot and Reset Password Recovery', () => {
    it('should return 200 OK for forgot-password even if email is missing (no leak)', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: { email: 'nonexistent@test.com' },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.debugToken).toBeUndefined();
    });

    it('should return debugToken during forgot-password request in dev/test environment', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: 'user-1',
        companyId: 'company-a',
        email: 'john@test.com',
        isActive: true,
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: { email: 'john@test.com' },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.debugToken).toBeDefined(); // returned in test env
    });

    it('should reset password successfully and mark other tokens as used', async () => {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        expiresAt,
        usedAt: null,
        user: {
          id: 'user-1',
          isActive: true,
          passwordHash: hashPassword('OldPassword123!'),
        },
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: {
          token: 'someTokenString',
          newPassword: 'StrongNewResetPassword1!',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalled();
    });

    it('should reject reset password if token has expired', async () => {
      const expiresAt = new Date(Date.now() - 60 * 60 * 1000); // Expired
      vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        expiresAt,
        usedAt: null,
        user: { id: 'user-1', isActive: true },
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: {
          token: 'expiredTokenString',
          newPassword: 'StrongNewResetPassword1!',
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('5. User Invitation and Acceptance Flow', () => {
    it('should create invite with tokenHash for HR, MANAGER or VIEWER role as ADMIN', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null); // No existing email
      vi.mocked(prisma.userInvite.findFirst).mockResolvedValue(null); // No pending invite
      vi.mocked(prisma.userInvite.create).mockResolvedValue({
        id: 'invite-1',
        email: 'newhire@test.com',
        role: 'MANAGER',
        expiresAt: new Date(),
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/users/invite',
        headers: getAuthHeader('ADMIN'),
        payload: {
          email: 'newhire@test.com',
          role: 'MANAGER',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.debugToken).toBeDefined();
    });

    it('should block inviting ADMIN or SUPER_ADMIN roles', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/users/invite',
        headers: getAuthHeader('ADMIN'),
        payload: {
          email: 'adminhire@test.com',
          role: 'ADMIN',
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('should block duplicating pending invites for same company and email', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.userInvite.findFirst).mockResolvedValue({
        id: 'invite-existing',
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/users/invite',
        headers: getAuthHeader('ADMIN'),
        payload: {
          email: 'dup@test.com',
          role: 'HR',
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('PENDING_INVITE_EXISTS');
    });

    it('should accept invite successfully and register active user', async () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      vi.mocked(prisma.userInvite.findUnique).mockResolvedValue({
        id: 'invite-1',
        email: 'inviteduser@test.com',
        role: 'MANAGER',
        companyId: 'company-a',
        expiresAt,
        acceptedAt: null,
        company: { id: 'company-a', isActive: true },
      } as any);

      vi.mocked(prisma.user.findFirst).mockResolvedValue(null); // email doesn't exist
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'user-new',
        name: 'New Worker',
        email: 'inviteduser@test.com',
        role: 'MANAGER',
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/accept-invite',
        payload: {
          token: 'validInviteToken',
          name: 'New Worker',
          password: 'StrongInvitePassword123!',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.role).toBe('MANAGER');
    });

    it('should reject accept-invite if the company has been deactivated', async () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      vi.mocked(prisma.userInvite.findUnique).mockResolvedValue({
        id: 'invite-1',
        email: 'inviteduser@test.com',
        role: 'MANAGER',
        companyId: 'company-a',
        expiresAt,
        acceptedAt: null,
        company: { id: 'company-a', isActive: false }, // Inactive company
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/accept-invite',
        payload: {
          token: 'validInviteToken',
          name: 'New Worker',
          password: 'StrongInvitePassword123!',
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('COMPANY_DEACTIVATED');
    });
  });

  describe('6. Brute Force Protection (Rate Limiting)', () => {
    it('should return 429 TOO_MANY_ATTEMPTS after 5 failures', async () => {
      // Mock redis to return "5" (representing limit met)
      vi.mocked(redis.get).mockResolvedValue('5');

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'brute@test.com',
          password: 'WrongPassword!',
        },
      });

      expect(res.statusCode).toBe(429);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('TOO_MANY_ATTEMPTS');
    });

    it('should reset attempts on successful login', async () => {
      const storedHash = hashPassword('SuccessPassword123!');
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: 'user-success',
        name: 'Success User',
        email: 'success@test.com',
        passwordHash: storedHash,
        role: 'HR',
        companyId: 'company-a',
        isActive: true,
        company: { id: 'company-a', isActive: true },
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'success@test.com',
          password: 'SuccessPassword123!',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(redis.del).toHaveBeenCalled(); // Reset attempts
    });
  });

  describe('7. Production Response Safety', () => {
    it('should NEVER return debugToken in production env', async () => {
      // Temporarily change environment
      const originalEnv = env.NODE_ENV;
      (env as any).NODE_ENV = 'production';

      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: 'user-prod',
        companyId: 'company-a',
        email: 'prod@test.com',
        isActive: true,
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: { email: 'prod@test.com' },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.debugToken).toBeUndefined();

      // Reset environment
      (env as any).NODE_ENV = originalEnv;
    });
  });
});
