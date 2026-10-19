import type { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtSessionPayload } from '@simrt/shared-types';
import { UserRole } from '@simrt/shared-types';
import { ErrorCode } from '@simrt/shared-types';

declare module 'fastify' {
  interface FastifyRequest {
    userSession?: JwtSessionPayload;
  }
}

/**
 * JWT Authentication Middleware
 */
export async function authenticateJwt(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({
        success: false,
        error: {
          code: ErrorCode.ERR_UNAUTHORIZED,
          message: 'Sesi login tidak ditemukan. Silakan login kembali.',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = request.server.jwt.verify<JwtSessionPayload>(token);
    request.userSession = decoded;
  } catch {
    reply.status(401).send({
      success: false,
      error: {
        code: ErrorCode.ERR_UNAUTHORIZED,
        message: 'Sesi token kedaluwarsa atau tidak valid.',
      },
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Role-Based Access Control Guard
 */
export function requireRoles(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.userSession) {
      reply.status(401).send({
        success: false,
        error: {
          code: ErrorCode.ERR_UNAUTHORIZED,
          message: 'Autentikasi diperlukan.',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!allowedRoles.includes(request.userSession.role)) {
      reply.status(403).send({
        success: false,
        error: {
          code: ErrorCode.ERR_FORBIDDEN,
          message: 'Akses ditolak. Wewenang Anda tidak mencukupi untuk aksi ini.',
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
}
