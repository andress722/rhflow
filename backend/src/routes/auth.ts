import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { verifyPassword, hashPassword } from '../lib/crypto';
import { RateLimiter } from '../lib/rate-limiter';
import { env } from '../config/env';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(12, 'Nova senha deve ter no mínimo 12 caracteres'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  newPassword: z.string().min(12, 'Nova senha deve ter no mínimo 12 caracteres'),
});

const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  name: z.string().min(1, 'Nome é obrigatório'),
  password: z.string().min(12, 'Senha deve ter no mínimo 12 caracteres'),
});

// Helper to validate strong password policy
function isStrongPassword(password: string): boolean {
  if (password.length < 12) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasDigit && hasSymbol;
}

// Helper to mask email in logs to protect user privacy
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/login
  fastify.post('/auth/login', async (request, reply) => {
    const bodyResult = loginSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados de login inválidos',
          details: bodyResult.error.errors,
        },
      });
    }

    const { email, password } = bodyResult.data;
    const normalizedEmail = email.toLowerCase().trim();
    const clientIp = request.ip;

    const emailBruteKey = `brute:login:email:${normalizedEmail}`;
    const ipBruteKey = `brute:login:ip:${clientIp}`;

    // Apply Rate Limiting (Brute Force Protection) BEFORE validating credentials
    const isIpBlocked = await RateLimiter.isBlocked(ipBruteKey);
    const isEmailBlocked = await RateLimiter.isBlocked(emailBruteKey);

    if (isIpBlocked || isEmailBlocked) {
      // Do not log plain password or token. Log masked email
      await prisma.auditLog.create({
        data: {
          companyId: 'SYSTEM', // Fallback to system audit since user is blocked
          action: 'LOGIN_FAILED',
          entity: 'User',
          metadata: {
            reason: 'TOO_MANY_ATTEMPTS',
            maskedEmail: maskEmail(normalizedEmail),
            ip: clientIp,
          },
        },
      });

      return reply.status(429).send({
        success: false,
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Múltiplas tentativas de login incorretas. Acesso bloqueado por 15 minutos.',
        },
      });
    }

    // Search for user
    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail },
      include: { company: true },
    });

    // Check credentials and active state (Generic error response to prevent email discovery)
    if (!user || !user.isActive || !user.company.isActive) {
      await RateLimiter.increment(emailBruteKey);
      await RateLimiter.increment(ipBruteKey);

      await prisma.auditLog.create({
        data: {
          companyId: user?.companyId || 'SYSTEM',
          userId: user?.id || null,
          action: 'LOGIN_FAILED',
          entity: 'User',
          metadata: {
            reason: 'INVALID_CREDENTIALS',
            maskedEmail: maskEmail(normalizedEmail),
            ip: clientIp,
          },
        },
      });

      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'E-mail ou senha incorretos.',
        },
      });
    }

    // Verify PBKDF2 password
    const isPasswordValid = verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      await RateLimiter.increment(emailBruteKey);
      await RateLimiter.increment(ipBruteKey);

      await prisma.auditLog.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          action: 'LOGIN_FAILED',
          entity: 'User',
          metadata: {
            reason: 'INVALID_CREDENTIALS',
            maskedEmail: maskEmail(normalizedEmail),
            ip: clientIp,
          },
        },
      });

      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'E-mail ou senha incorretos.',
        },
      });
    }

    // Success: reset rate limit attempts
    await RateLimiter.reset(emailBruteKey);
    await RateLimiter.reset(ipBruteKey);

    // Sign JWT token
    const token = fastify.jwt.sign({
      sub: user.id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
      mustChangePassword: user.mustChangePassword,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create AuditLog
    await prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        entity: 'User',
        entityId: user.id,
        metadata: {
          ip: clientIp,
        },
      },
    });

    return reply.status(200).send({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          mustChangePassword: user.mustChangePassword,
        },
      },
    });
  });

  // GET /api/auth/me
  fastify.get(
    '/auth/me',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub } = request.user;

      const user = await prisma.user.findUnique({
        where: { id: sub },
      });

      if (!user || !user.isActive) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Usuário não encontrado ou inativo',
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
            mustChangePassword: user.mustChangePassword,
          },
        },
      });
    },
  );

  // POST /api/auth/change-password (Authenticated but bypasses standard mustChangePassword block)
  fastify.post(
    '/auth/change-password',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub, companyId } = request.user;

      const bodyResult = changePasswordSchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos.',
            details: bodyResult.error.errors,
          },
        });
      }

      const { currentPassword, newPassword } = bodyResult.data;

      // 1. Fetch user
      const user = await prisma.user.findUnique({
        where: { id: sub },
      });

      if (!user || !user.isActive) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Usuário não encontrado ou inativo.',
          },
        });
      }

      // 2. Verify current password
      const isCurrentValid = verifyPassword(currentPassword, user.passwordHash);
      if (!isCurrentValid) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: 'A senha atual informada está incorreta.',
          },
        });
      }

      // 3. Enforce password complexity rules
      if (!isStrongPassword(newPassword)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'A nova senha deve ter no mínimo 12 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.',
          },
        });
      }

      // 4. Ensure new password is not equal to current password
      if (currentPassword === newPassword) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'SAME_PASSWORD',
            message: 'A nova senha não pode ser igual à senha atual.',
          },
        });
      }

      // 5. Update user password hash
      const newHash = hashPassword(newPassword);
      const updatedUser = await prisma.user.update({
        where: { id: sub },
        data: {
          passwordHash: newHash,
          mustChangePassword: false,
        },
      });

      // 6. AuditLog
      await prisma.auditLog.create({
        data: {
          companyId,
          userId: sub,
          action: 'PASSWORD_CHANGED',
          entity: 'User',
          entityId: sub,
          metadata: {},
        },
      });

      // Sign and return a new accessToken with mustChangePassword = false
      const newToken = fastify.jwt.sign({
        sub: updatedUser.id,
        companyId: updatedUser.companyId,
        role: updatedUser.role,
        email: updatedUser.email,
        mustChangePassword: false,
      });

      return reply.status(200).send({
        success: true,
        data: {
          token: newToken,
          user: {
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            companyId: updatedUser.companyId,
            mustChangePassword: false,
          },
        },
      });
    },
  );

  // POST /api/auth/forgot-password
  fastify.post('/auth/forgot-password', async (request, reply) => {
    const bodyResult = forgotPasswordSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'E-mail inválido.',
          details: bodyResult.error.errors,
        },
      });
    }

    const { email } = bodyResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const user = await prisma.user.findFirst({
        where: { email: normalizedEmail, isActive: true },
      });

      const isDevOrTest = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
      let debugToken: string | undefined = undefined;

      if (user) {
        // Generate secure token (64 hex characters)
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes

        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
        });

        await prisma.auditLog.create({
          data: {
            companyId: user.companyId,
            userId: user.id,
            action: 'PASSWORD_RESET_REQUESTED',
            entity: 'User',
            entityId: user.id,
            metadata: {},
          },
        });

        if (isDevOrTest) {
          debugToken = token;
        }
      }

      // Always return 200 OK to prevent account enumeration
      return reply.status(200).send({
        success: true,
        message: 'Se o e-mail estiver cadastrado, um link de recuperação será enviado.',
        ...(debugToken ? { debugToken } : {}),
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao processar solicitação.',
        },
      });
    }
  });

  // POST /api/auth/reset-password
  fastify.post('/auth/reset-password', async (request, reply) => {
    const bodyResult = resetPasswordSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos.',
          details: bodyResult.error.errors,
        },
      });
    }

    const { token, newPassword } = bodyResult.data;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    try {
      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'O token de recuperação é inválido, expirou ou já foi utilizado.',
          },
        });
      }

      if (!resetToken.user.isActive) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'USER_INACTIVE',
            message: 'Usuário associado a este token está inativo.',
          },
        });
      }

      if (!isStrongPassword(newPassword)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'A nova senha deve ter no mínimo 12 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.',
          },
        });
      }

      // Check if new password is same as current password
      const isSamePassword = verifyPassword(newPassword, resetToken.user.passwordHash);
      if (isSamePassword) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'SAME_PASSWORD',
            message: 'A nova senha não pode ser igual à senha atual.',
          },
        });
      }

      // Perform reset in a transaction
      await prisma.$transaction(async (tx) => {
        // Update user password and clear mustChangePassword
        await tx.user.update({
          where: { id: resetToken.userId },
          data: {
            passwordHash: hashPassword(newPassword),
            mustChangePassword: false,
          },
        });

        // Mark current token as used
        await tx.passwordResetToken.update({
          where: { id: resetToken.id },
          data: { usedAt: new Date() },
        });

        // Invalidate all other pending reset tokens for this user
        await tx.passwordResetToken.updateMany({
          where: {
            userId: resetToken.userId,
            usedAt: null,
          },
          data: {
            usedAt: new Date(),
          },
        });

        // AuditLog
        await tx.auditLog.create({
          data: {
            companyId: resetToken.user.companyId,
            userId: resetToken.userId,
            action: 'PASSWORD_RESET_COMPLETED',
            entity: 'User',
            entityId: resetToken.userId,
            metadata: {},
          },
        });
      });

      return reply.status(200).send({
        success: true,
        message: 'Senha alterada com sucesso.',
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao redefinir senha.',
        },
      });
    }
  });

  // POST /api/auth/accept-invite
  fastify.post('/auth/accept-invite', async (request, reply) => {
    const bodyResult = acceptInviteSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos.',
          details: bodyResult.error.errors,
        },
      });
    }

    const { token, name, password } = bodyResult.data;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    try {
      const invite = await prisma.userInvite.findUnique({
        where: { tokenHash },
        include: { company: true },
      });

      if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'O convite é inválido, expirou ou já foi aceito.',
          },
        });
      }

      if (!invite.company.isActive) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'COMPANY_DEACTIVATED',
            message: 'A empresa deste convite foi desativada.',
          },
        });
      }

      // Check if email already registered
      const existingUser = await prisma.user.findFirst({
        where: { email: invite.email },
      });
      if (existingUser) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'Já existe um usuário cadastrado com este e-mail.',
          },
        });
      }

      if (!isStrongPassword(password)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'A senha deve ter no mínimo 12 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.',
          },
        });
      }

      // Perform acceptance in a transaction
      const newUser = await prisma.$transaction(async (tx) => {
        // 1. Create active User
        const createdUser = await tx.user.create({
          data: {
            companyId: invite.companyId,
            name,
            email: invite.email.toLowerCase().trim(),
            passwordHash: hashPassword(password),
            role: invite.role,
            isActive: true,
            mustChangePassword: false,
          },
        });

        // 2. Mark invite as accepted
        await tx.userInvite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        });

        // 3. Create AuditLog
        await tx.auditLog.create({
          data: {
            companyId: invite.companyId,
            userId: createdUser.id,
            action: 'USER_INVITE_ACCEPTED',
            entity: 'UserInvite',
            entityId: invite.id,
            metadata: {
              role: invite.role,
            },
          },
        });

        return createdUser;
      });

      return reply.status(200).send({
        success: true,
        message: 'Convite aceito com sucesso. Usuário cadastrado.',
        data: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao aceitar convite.',
        },
      });
    }
  });
}
