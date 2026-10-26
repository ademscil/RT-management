import type { FastifyPluginAsync } from 'fastify';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { AuditLogService } from '../../infrastructure/ledger/audit-log.service.js';
import {
  PaginationQuerySchema,
  buildPaginationMeta,
  UserRole,
} from '@simrt/shared-types';
import { authenticateJwt, requireRoles } from '../middlewares/auth.middleware.js';
import {
  getRtId,
  resolveTenantContext,
} from '../middlewares/tenant.middleware.js';

export const auditRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = PrismaService.getInstance();

  fastify.addHook('preHandler', authenticateJwt);
  fastify.addHook('preHandler', resolveTenantContext);
  fastify.addHook('preHandler', requireRoles([UserRole.KETUA_RT, UserRole.SEKRETARIS]));

  /**
   * GET /api/v1/audit/logs (Security Audit Logs with Server-Side Pagination & Search)
   */
  fastify.get('/logs', async (request, reply) => {
    const parseResult = PaginationQuerySchema.safeParse(request.query);
    const { page, limit, search } = parseResult.success
      ? parseResult.data
      : { page: 1, limit: 10, search: undefined };

    // TENANT SCOPE — the audit trail is per RT. An empty `where` here exposed
    // every community's PII-access history (who opened whose NIK, from which IP).
    const where: Record<string, unknown> = { rtId: getRtId(request) };
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
        orderBy: { sequence: 'desc' },
      }),
      prisma.securityAuditLog.count({ where }),
    ]);

    const formatted = items.map((l) => ({
      id: l.id,
      sequence: l.sequence,
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
  fastify.get('/verify-chain', async (request, reply) => {
    // Verify ONLY this tenant's chain. Audit chains are independent per RT, so a
    // global "verify all rows" walk reports a false tamper verdict as soon as a
    // second community appends anything.
    const result = await AuditLogService.verifyTenantChain(prisma, getRtId(request));

    return reply.send({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  });
};
