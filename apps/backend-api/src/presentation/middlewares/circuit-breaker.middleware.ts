import type { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import type { SSEBrokerService } from '../../infrastructure/realtime/sse-broker.service.js';
import { ErrorCode, NotificationCategory, NotificationPriority } from '@simrt/shared-types';

interface PiiAccessWindow {
  timestamps: number[];
  isFrozen: boolean;
}

export class PiiCircuitBreaker {
  // Sliding window per userId: array of timestamps
  private static accessWindows = new Map<string, PiiAccessWindow>();
  private static readonly MAX_REQUESTS = 10;
  private static readonly WINDOW_MS = 3 * 60 * 1000; // 3 minutes

  public static createMiddleware(sseBroker: SSEBrokerService) {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const user = request.userSession;
      if (!user) return;

      const userId = user.userId;
      const now = Date.now();

      let windowData = PiiCircuitBreaker.accessWindows.get(userId);
      if (!windowData) {
        windowData = { timestamps: [], isFrozen: false };
        PiiCircuitBreaker.accessWindows.set(userId, windowData);
      }

      // If already frozen
      if (windowData.isFrozen) {
        reply.status(429).send({
          success: false,
          error: {
            code: ErrorCode.ERR_CIRCUIT_BREAKER_TRIGGERED,
            message: 'Sesi akun Anda telah dibekukan sementara karena terdeteksi anomali akses PII berlebihan.',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Filter out timestamps older than 3 minutes
      windowData.timestamps = windowData.timestamps.filter((t) => now - t < PiiCircuitBreaker.WINDOW_MS);
      windowData.timestamps.push(now);

      // Check if threshold exceeded
      if (windowData.timestamps.length > PiiCircuitBreaker.MAX_REQUESTS) {
        windowData.isFrozen = true;

        // Freeze in database
        const prisma = PrismaService.getInstance();
        await prisma.user.update({
          where: { id: userId },
          data: {
            isActive: false,
            lockedUntil: new Date(now + 15 * 60 * 1000), // Lock for 15 mins
          },
        });

        // Broadcast Critical Security Alert via SSE
        sseBroker.broadcast('security_alert', {
          id: `SEC-${now}`,
          title: 'PERINGATAN KEAMANAN KRITIS: PII SCRAPING TERDETEKSI',
          message: `Akun pengurus '${user.username}' telah dibekukan otomatis karena memanggil data NIK/KTP lebih dari 10 kali dalam 3 menit.`,
          category: NotificationCategory.KEAMANAN,
          priority: NotificationPriority.SECURITY,
          deepLink: '/security-audit',
          createdAt: new Date().toISOString(),
        });

        reply.status(429).send({
          success: false,
          error: {
            code: ErrorCode.ERR_CIRCUIT_BREAKER_TRIGGERED,
            message: 'PII Scraping Circuit Breaker aktif. Akun dibekukan dan peringatan keamanan telah dikirim ke Ketua RT.',
          },
          timestamp: new Date().toISOString(),
        });
      }
    };
  }
}
