import type { FastifyPluginAsync } from 'fastify';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { HashChainService } from '../../infrastructure/ledger/hash-chain.service.js';
import {
  PaginationQuerySchema,
  buildPaginationMeta,
  UserRole,
} from '@simrt/shared-types';
import { authenticateJwt, requireRoles } from '../middlewares/auth.middleware.js';

export const auditRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = PrismaService.getInstance();
  const hashChainService = new HashChainService();

  fastify.addHook('preHandler', authenticateJwt);
  fastify.addHook('preHandler', requireRoles([UserRole.KETUA_RT, UserRole.SEKRETARIS]));

  /**
   * GET /api/v1/audit/logs (Security Audit Logs with Server-Side Pagination & Search)
   */
  fastify.get('/logs', async (request, reply) => {
    const parseResult = PaginationQuerySchema.safeParse(request.query);
    const { page, limit, search } = parseResult.success
      ? parseResult.data
      : { page: 1, limit: 10, search: undefined };

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { actionType: { contains: search, mode: 'insensitive' } },
        { targetEntity: { contains: search, mode: 'insensitive' } },
        { accessReason: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search } },
      ];
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.securityAuditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.securityAuditLog.count({ where }),
    ]);

    const formatted = items.map((l) => ({
      id: l.id,
      actorUserId: l.actorUserId,
      actorRole: l.actorRole,
      actionType: l.actionType,
      targetEntity: l.targetEntity,
      targetId: l.targetId,
      accessReason: l.accessReason,
      ipAddress: l.ipAddress,
      userAgent: l.userAgent,
      prevHash: l.prevHash,
      rowHash: l.rowHash,
      createdAt: l.createdAt.toISOString(),
    }));

    return reply.send({
      success: true,
      data: {
        items: formatted,
        meta: buildPaginationMeta(total, page, limit),
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /api/v1/audit/verify-chain (Verify Mathematical Integrity of Security Audit Logs)
   */
  fastify.get('/verify-chain', async (_request, reply) => {
    const logs = await prisma.securityAuditLog.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const mapped = logs.map((l) => ({
      id: l.id,
      actorId: l.actorUserId,
      actionOrNominal: `${l.actionType}:${l.targetId}:${l.accessReason || ''}`,
      timestampIso: l.createdAt.toISOString(),
      prevHash: l.prevHash,
      rowHash: l.rowHash,
    }));

    const result = hashChainService.verifyChain(mapped);

    return reply.send({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  });
};
