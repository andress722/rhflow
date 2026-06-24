import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Middleware factory to check user roles
 */
export function requireRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;

    if (!user || !allowedRoles.includes(user.role)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Você não tem permissão para acessar este recurso',
        },
      });
    }
  };
}
