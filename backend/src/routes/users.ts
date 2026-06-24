import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/crypto';
import { requireRole } from '../lib/auth-middleware';
import { env } from '../config/env';

const userRoleSchema = z.enum(['ADMIN', 'HR', 'MANAGER', 'VIEWER']);

const createUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  role: userRoleSchema,
});

const updateUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  email: z.string().email('E-mail inválido').optional(),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').optional(),
  role: userRoleSchema.optional(),
});

export default async function usersRoutes(fastify: FastifyInstance) {
  // Apply JWT authentication globally for these routes
  fastify.addHook('preHandler', fastify.authenticate);
  // Apply RBAC: ADMIN or HR only
  fastify.addHook('preHandler', requireRole(['ADMIN', 'HR']));

  // GET /api/users
  fastify.get('/users', async (request, reply) => {
    const { companyId } = request.user;

    const users = await prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return reply.status(200).send({
      success: true,
      data: users,
    });
  });

  // POST /api/users
  fastify.post('/users', async (request, reply) => {
    const { companyId } = request.user;

    const bodyResult = createUserSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: bodyResult.error.errors,
        },
      });
    }

    const { name, email, password, role } = bodyResult.data;

    // Check if email already registered in company
    const existingUser = await prisma.user.findFirst({
      where: { companyId, email },
    });

    if (existingUser) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'DUPLICATE_EMAIL',
          message: 'Este e-mail já está cadastrado nesta empresa.',
        },
      });
    }

    // Hash the password with PBKDF2
    const passwordHash = hashPassword(password);

    const user = await prisma.user.create({
      data: {
        companyId,
        name,
        email,
        passwordHash,
        role,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    return reply.status(201).send({
      success: true,
      data: user,
    });
  });

  // GET /api/users/:id
  fastify.get('/users/:id', async (request, reply) => {
    const { companyId } = request.user;
    const { id } = request.params as { id: string };

    const user = await prisma.user.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Usuário não encontrado',
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: user,
    });
  });

  // PATCH /api/users/:id
  fastify.patch('/users/:id', async (request, reply) => {
    const { companyId } = request.user;
    const { id } = request.params as { id: string };

    const bodyResult = updateUserSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: bodyResult.error.errors,
        },
      });
    }

    // Verify user exists and belongs to company
    const existingUser = await prisma.user.findFirst({
      where: { id, companyId },
    });

    if (!existingUser) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Usuário não encontrado',
        },
      });
    }

    const { name, email, password, role } = bodyResult.data;
    const updateData: any = {};

    if (name) updateData.name = name;
    if (email) {
      // Check duplicate
      const duplicate = await prisma.user.findFirst({
        where: {
          companyId,
          email,
          id: { not: id },
        },
      });
      if (duplicate) {
        return reply.status(492).send({
          success: false,
          error: {
            code: 'DUPLICATE_EMAIL',
            message: 'Este e-mail já está sendo usado por outro usuário.',
          },
        });
      }
      updateData.email = email;
    }
    if (password) {
      updateData.passwordHash = hashPassword(password);
    }
    if (role) {
      // If changing role of himself, prevent locking out admin or changing own role to lock out
      if (id === request.user.sub && role !== existingUser.role) {
        // If own role changes from ADMIN, ensure they are not the last active admin
        if (existingUser.role === 'ADMIN') {
          const activeAdminsCount = await prisma.user.count({
            where: { companyId, role: 'ADMIN', isActive: true },
          });
          if (activeAdminsCount === 1) {
            return reply.status(400).send({
              success: false,
              error: {
                code: 'OWN_ROLE_CHANGE_BLOCKED',
                message: 'Não é possível alterar seu próprio perfil de administrador se você for o único administrador ativo.',
              },
            });
          }
        }
      }
      updateData.role = role;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    return reply.status(200).send({
      success: true,
      data: updatedUser,
    });
  });

  // PATCH /api/users/:id/activate
  fastify.patch('/users/:id/activate', async (request, reply) => {
    const { companyId } = request.user;
    const { id } = request.params as { id: string };

    const user = await prisma.user.findFirst({
      where: { id, companyId },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Usuário não encontrado',
        },
      });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: { id: true, name: true, isActive: true },
    });

    return reply.status(200).send({
      success: true,
      data: updated,
    });
  });

  // PATCH /api/users/:id/deactivate
  fastify.patch('/users/:id/deactivate', async (request, reply) => {
    const { companyId, sub } = request.user;
    const { id } = request.params as { id: string };

    // 8. Bloquear desativação do próprio usuário
    if (id === sub) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'SELF_DEACTIVATION_BLOCKED',
          message: 'Você não pode desativar o seu próprio usuário.',
        },
      });
    }

    const user = await prisma.user.findFirst({
      where: { id, companyId },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Usuário não encontrado',
        },
      });
    }

    // 9. Bloquear desativação do último ADMIN ativo da empresa
    if (user.role === 'ADMIN' && user.isActive) {
      const activeAdminsCount = await prisma.user.count({
        where: { companyId, role: 'ADMIN', isActive: true },
      });
      if (activeAdminsCount === 1) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'LAST_ADMIN_DEACTIVATION_BLOCKED',
            message: 'Não é possível desativar o último administrador ativo da empresa.',
          },
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    });

    return reply.status(200).send({
      success: true,
      data: updated,
    });
  });

  // Helper to mask email in audit log
  function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    if (local.length <= 2) return `${local[0]}***@${domain}`;
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
  }

  // POST /api/users/invite
  fastify.post('/users/invite', async (request, reply) => {
    const { companyId, sub } = request.user;

    const inviteSchema = z.object({
      email: z.string().email('E-mail inválido'),
      role: z.enum(['HR', 'MANAGER', 'VIEWER'], {
        errorMap: () => ({ message: 'Perfil de convite deve ser HR, MANAGER ou VIEWER.' }),
      }),
    });

    const bodyResult = inviteSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados de convite inválidos.',
          details: bodyResult.error.errors,
        },
      });
    }

    const { email, role } = bodyResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Bloquear se já existe User com email
    const existingUser = await prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'USER_ALREADY_EXISTS',
          message: 'Já existe um usuário cadastrado com este e-mail no sistema.',
        },
      });
    }

    // Bloquear se já existe convite pendente para email + companyId
    const existingInvite = await prisma.userInvite.findFirst({
      where: {
        companyId,
        email: normalizedEmail,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'PENDING_INVITE_EXISTS',
          message: 'Já existe um convite pendente ativo para este e-mail nesta empresa.',
        },
      });
    }

    // Gerar token seguro
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Salvar convite
    const invite = await prisma.userInvite.create({
      data: {
        companyId,
        email: normalizedEmail,
        role,
        tokenHash,
        expiresAt,
        createdByUserId: sub,
      },
    });

    // Criar AuditLog
    await prisma.auditLog.create({
      data: {
        companyId,
        userId: sub,
        action: 'USER_INVITED',
        entity: 'UserInvite',
        entityId: invite.id,
        metadata: {
          role,
          maskedEmail: maskEmail(normalizedEmail),
        },
      },
    });

    const isDevOrTest = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';

    return reply.status(201).send({
      success: true,
      message: 'Convite criado com sucesso.',
      data: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
        ...(isDevOrTest ? { debugToken: token } : {}),
      },
    });
  });

  // GET /api/users/invites
  fastify.get('/users/invites', async (request, reply) => {
    const { companyId } = request.user;

    const invites = await prisma.userInvite.findMany({
      where: { companyId },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        createdAt: true,
        createdByUserId: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return reply.status(200).send({
      success: true,
      data: invites,
    });
  });
}

