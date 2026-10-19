import type { FastifyPluginAsync } from 'fastify';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import type { SSEBrokerService } from '../../infrastructure/realtime/sse-broker.service.js';
import {
  NotificationQueryFilterSchema,
  buildPaginationMeta,
  ErrorCode,
} from '@simrt/shared-types';
import { authenticateJwt } from '../middlewares/auth.middleware.js';

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = PrismaService.getInstance();
  const sseBroker = (fastify as any).sseBroker as SSEBrokerService;

  /**
   * OPTIONS & GET /api/v1/notifications/stream (Server-Sent Events Real-Time Stream)
   */
  fastify.options('/stream', async (request, reply) => {
    const origin = request.headers.origin || '*';
    reply.raw.setHeader('Access-Control-Allow-Origin', origin);
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
    reply.raw.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
    reply.raw.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    reply.raw.statusCode = 204;
    reply.raw.end();
  });

  fastify.get('/stream', async (request, reply) => {
    const origin = request.headers.origin || '*';
    reply.raw.setHeader('Access-Control-Allow-Origin', origin);
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
    reply.raw.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');

    // Authenticate token via query param (?token=...) or header for SSE compatibility
    const query = request.query as { token?: string };
    const authHeader = request.headers.authorization;
    const token = query.token || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (!token) {
      reply.raw.setHeader('Content-Type', 'application/json');
      reply.raw.statusCode = 401;
      reply.raw.end(
        JSON.stringify({
          success: false,
          error: { code: ErrorCode.ERR_UNAUTHORIZED, message: 'Token diperlukan untuk koneksi SSE.' },
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    try {
      const decoded = fastify.jwt.verify<any>(token);

      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in Caddy / Nginx
      reply.raw.flushHeaders();

      // Send initial connect greeting immediately
      reply.raw.write(
        `event: connected\ndata: ${JSON.stringify({ status: 'connected', time: new Date().toISOString() })}\n\n`
      );

      // Register client in SSE Broker
      sseBroker.registerClient(decoded.userId, decoded.role, reply);

      // Heartbeat keepalive ping
      const pingTimer = setInterval(() => {
        try {
          reply.raw.write(': ping\n\n');
        } catch {
          clearInterval(pingTimer);
        }
      }, 15000);

      request.raw.on('close', () => {
        clearInterval(pingTimer);
        sseBroker.unregisterClient(decoded.userId, reply);
      });
    } catch {
      reply.raw.setHeader('Content-Type', 'application/json');
      reply.raw.statusCode = 401;
      reply.raw.end(
        JSON.stringify({
          success: false,
          error: { code: ErrorCode.ERR_UNAUTHORIZED, message: 'Token kedaluwarsa atau tidak valid.' },
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }
  });

  fastify.register(async (authenticatedFastify) => {
    authenticatedFastify.addHook('preHandler', authenticateJwt);

    /**
     * GET /api/v1/notifications (In-App Notification Center Inbox with Pagination)
     */
    authenticatedFastify.get('/', async (request, reply) => {
      const parseResult = NotificationQueryFilterSchema.safeParse(request.query);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.errors[0].message },
          timestamp: new Date().toISOString(),
        });
      }

      const { page, limit, category, isRead } = parseResult.data;
      const session = request.userSession!;

      const where: Record<string, unknown> = { userId: session.userId };
      if (category) where.kategori = category;
      if (isRead !== undefined) where.isRead = isRead;

      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        prisma.inAppNotification.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.inAppNotification.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: {
          items: items.map((n) => ({
            id: n.id,
            kategori: n.kategori,
            type: n.kategori,
            priority: n.priority,
            judul: n.judul,
            title: n.judul,
            pesan: n.pesan,
            message: n.pesan,
            actionLabel: n.actionLabel,
            deepLinkUrl: n.deepLinkUrl,
            isRead: n.isRead,
            createdAt: n.createdAt.toISOString(),
          })),
          meta: buildPaginationMeta(total, page, limit),
        },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * GET /api/v1/notifications/unread-count (Unread notification count badge)
     */
    authenticatedFastify.get('/unread-count', async (request, reply) => {
      const session = request.userSession!;
      const count = await prisma.inAppNotification.count({
        where: {
          userId: session.userId,
          isRead: false,
        },
      });

      return reply.send({
        success: true,
        data: { unreadCount: count },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * POST /api/v1/notifications/mark-read & POST /api/v1/notifications/mark-all-read
     */
    authenticatedFastify.post('/mark-all-read', async (request, reply) => {
      const session = request.userSession!;
      await prisma.inAppNotification.updateMany({
        where: { userId: session.userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });

      return reply.send({
        success: true,
        data: { message: 'Semua notifikasi berhasil ditandai telah dibaca.' },
        timestamp: new Date().toISOString(),
      });
    });

    authenticatedFastify.post('/mark-read', async (request, reply) => {
      const { notificationId, all } = (request.body as { notificationId?: string; all?: boolean }) || {};
      const session = request.userSession!;

      if (all) {
        await prisma.inAppNotification.updateMany({
          where: { userId: session.userId, isRead: false },
          data: { isRead: true, readAt: new Date() },
        });
      } else if (notificationId) {
        await prisma.inAppNotification.update({
          where: { id: notificationId },
          data: { isRead: true, readAt: new Date() },
        });
      }

      return reply.send({
        success: true,
        data: { message: 'Notifikasi berhasil ditandai telah dibaca.' },
        timestamp: new Date().toISOString(),
      });
    });
  });
};
