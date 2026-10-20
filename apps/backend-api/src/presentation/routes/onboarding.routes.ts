import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { PdfGeneratorService } from '../../infrastructure/pdf/pdf-generator.service.js';
import {
  PaginationQuerySchema,
  buildPaginationMeta,
  UserRole,
  ErrorCode,
} from '@simrt/shared-types';
import { authenticateJwt, requireRoles } from '../middlewares/auth.middleware.js';

export const onboardingRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = PrismaService.getInstance();
  const pdfService = new PdfGeneratorService();

  fastify.addHook('preHandler', authenticateJwt);
  fastify.addHook('preHandler', requireRoles([UserRole.KETUA_RT, UserRole.SEKRETARIS]));

  /**
   * POST /api/v1/onboarding/generate-cards (Generates A4 PDF sheet of 8 QR Activation Cards)
   */
  fastify.post('/generate-cards', async (_request, reply) => {
    // Find unverified or unclaimed KKs
    const kks = await prisma.kartuKeluarga.findMany({
      where: {
        onboardingInvites: {
          none: { isClaimed: true },
        },
      },
      include: { rumah: true },
      take: 8,
    });

    const cardItems: Array<{ nomorKk: string; blok: string; nomorRumah: string; token: string }> = [];

    for (const kk of kks) {
      const rawToken = `SIMRT-INVITE-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const tokenMasked = `${rawToken.substring(0, 12)}****${rawToken.substring(rawToken.length - 4)}`;

      // Save invite token
      await prisma.onboardingInvite.create({
        data: {
          kkId: kk.id,
          rumahId: kk.rumahId,
          tokenHash,
          tokenMasked,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days expiry
          isClaimed: false,
        },
      });

      cardItems.push({
        nomorKk: kk.noKkMasked,
        blok: kk.rumah.kodeBlok,
        nomorRumah: kk.rumah.nomorRumah,
        token: rawToken,
      });
    }

    if (cardItems.length === 0) {
      // Mock card for demo if all already claimed
      cardItems.push({
        nomorKk: '327601******0001',
        blok: 'A1',
        nomorRumah: '01',
        token: `SIMRT-INVITE-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
      });
    }

    const pdfBuffer = await pdfService.generateQrActivationCards(cardItems);

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', 'attachment; filename="KARTU_AKTIVASI_WARGA_RT0502.pdf"');
    return reply.send(pdfBuffer);
  });

  /**
   * GET /api/v1/onboarding/card/:kkId (Generates Single Individual Activation QR Card PDF)
   */
  fastify.get('/card/:kkId', async (request, reply) => {
    const { kkId } = request.params as { kkId: string };

    const kk = await prisma.kartuKeluarga.findUnique({
      where: { id: kkId },
      include: {
        rumah: true,
        warga: true,
        onboardingInvites: {
          where: { isClaimed: false, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!kk) {
      return reply.status(404).send({
        success: false,
        error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Kartu Keluarga tidak ditemukan.' },
        timestamp: new Date().toISOString(),
      });
    }

    let rawToken: string;
    if (kk.onboardingInvites.length > 0) {
      // Create fresh token for single download to ensure token is in QR
      rawToken = `SIMRT-INVITE-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    } else {
      rawToken = `SIMRT-INVITE-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenMasked = `${rawToken.substring(0, 12)}****${rawToken.substring(rawToken.length - 4)}`;

    await prisma.onboardingInvite.create({
      data: {
        kkId: kk.id,
        rumahId: kk.rumahId,
        tokenHash,
        tokenMasked,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isClaimed: false,
      },
    });

    const kepalaKeluarga =
      kk.warga.find((w: any) => w.hubunganKeluarga === 'KEPALA_KELUARGA')?.namaLengkap ||
      kk.warga[0]?.namaLengkap ||
      'Kepala Keluarga';

    const rtConfig = await prisma.rukunTetanggaConfig.findFirst();
    const rtName = rtConfig ? `RT ${rtConfig.kodeRt} / RW ${rtConfig.kodeRw} - ${rtConfig.namaKelurahan}` : undefined;

    const pdfBuffer = await pdfService.generateSingleQrActivationCard({
      nomorKk: kk.noKkMasked,
      blok: kk.rumah.kodeBlok,
      nomorRumah: kk.rumah.nomorRumah,
      token: rawToken,
      kepalaKeluarga,
      rtName,
    });

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="KARTU_AKTIVASI_${kk.rumah.kodeBlok}_${kk.rumah.nomorRumah}.pdf"`);
    return reply.send(pdfBuffer);
  });

  /**
   * GET /api/v1/onboarding/invites (Paginated List of Invite Tokens)
   */
  fastify.get('/invites', async (request, reply) => {
    const parseResult = PaginationQuerySchema.safeParse(request.query);
    const { page, limit } = parseResult.success ? parseResult.data : { page: 1, limit: 10 };

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.onboardingInvite.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          rumah: true,
          kk: true,
        },
      }),
      prisma.onboardingInvite.count(),
    ]);

    const formatted = items.map((i) => ({
      id: i.id,
      blokRumah: `${i.rumah.kodeBlok} No. ${i.rumah.nomorRumah}`,
      nomorKkMasked: i.kk.noKkMasked,
      tokenMasked: i.tokenMasked,
      isClaimed: i.isClaimed,
      claimedAt: i.claimedAt?.toISOString(),
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
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
};
