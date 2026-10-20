import type { FastifyPluginAsync } from 'fastify';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { authenticateJwt, requireRoles } from '../middlewares/auth.middleware.js';
import { UserRole, ErrorCode } from '@simrt/shared-types';
import { Ed25519SignerAdapter } from '../../infrastructure/crypto/ed25519-signer.adapter.js';
import { EnvelopeCryptoAdapter } from '../../infrastructure/crypto/envelope-crypto.adapter.js';
import crypto from 'node:crypto';

export const configRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = PrismaService.getInstance();
  const signerAdapter = new Ed25519SignerAdapter();
  const cryptoAdapter = new EnvelopeCryptoAdapter();

  function formatRt(rt: any) {
    return {
      id: rt.id,
      kodeRt: rt.kodeRt,
      kodeRw: rt.kodeRw,
      namaKelurahan: rt.namaKelurahan,
      namaKecamatan: rt.namaKecamatan,
      namaKota: rt.namaKota,
      kodePos: rt.kodePos,
      ed25519PublicKey: rt.ed25519PublicKey,
      displayTitle: `RT ${rt.kodeRt} / RW ${rt.kodeRw}`,
      displaySub: `Kel. ${rt.namaKelurahan}, Kec. ${rt.namaKecamatan}, ${rt.namaKota}`,
      displayFull: `RT ${rt.kodeRt} / RW ${rt.kodeRw} Kel. ${rt.namaKelurahan}, Kec. ${rt.namaKecamatan}, ${rt.namaKota} ${rt.kodePos}`,
    };
  }

  /**
   * Helper: Ensure default RTs exist (Taman Bunga Pangkalpinang & Sukamaju Depok)
   */
  async function ensureDefaultRts() {
    let count = await prisma.rukunTetanggaConfig.count();
    if (count === 0) {
      // 1. Pangkalpinang
      const { publicKeyPem: pk1, privateKeyPem: sk1 } = signerAdapter.generateKeyPair();
      await prisma.rukunTetanggaConfig.create({
        data: {
          kodeRt: '010',
          kodeRw: '003',
          namaKelurahan: 'Taman Bunga',
          namaKecamatan: 'Gerunggang',
          namaKota: 'Kota Pangkalpinang',
          kodePos: '33119',
          ed25519PublicKey: pk1,
          ed25519PrivateKeyEnc: cryptoAdapter.encryptField(sk1),
        },
      });

      // 2. Sukamaju Depok
      const { publicKeyPem: pk2, privateKeyPem: sk2 } = signerAdapter.generateKeyPair();
      await prisma.rukunTetanggaConfig.create({
        data: {
          kodeRt: '05',
          kodeRw: '02',
          namaKelurahan: 'Sukamaju',
          namaKecamatan: 'Cilodong',
          namaKota: 'Kota Depok',
          kodePos: '16415',
          ed25519PublicKey: pk2,
          ed25519PrivateKeyEnc: cryptoAdapter.encryptField(sk2),
        },
      });
    }
  }

  /**
   * GET /api/v1/config/rt/list (Public - List all registered RT communities)
   */
  fastify.get('/rt/list', async (_request, reply) => {
    await ensureDefaultRts();
    const list = await prisma.rukunTetanggaConfig.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return reply.send({
      success: true,
      data: list.map(formatRt),
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /api/v1/config/rt (Public - Get specific or active RT Configuration)
   */
  fastify.get('/rt', async (request, reply) => {
    await ensureDefaultRts();

    const queryRtId = (request.query as any)?.rtId;
    const headerRtId = request.headers['x-rt-id'] as string | undefined;
    const targetId = queryRtId || headerRtId;

    let config;
    if (targetId) {
      config = await prisma.rukunTetanggaConfig.findUnique({
        where: { id: targetId },
      });
    }

    if (!config) {
      config = await prisma.rukunTetanggaConfig.findFirst({
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!config) {
      return reply.status(404).send({
        success: false,
        error: {
          code: ErrorCode.ERR_NOT_FOUND,
          message: 'Konfigurasi RT belum tersedia.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.send({
      success: true,
      data: formatRt(config),
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /api/v1/config/rt (Admin/Superuser Register New RT Community)
   */
  fastify.post(
    '/rt',
    { preHandler: [authenticateJwt, requireRoles([UserRole.SUPERUSER, UserRole.KETUA_RT])] },
    async (request, reply) => {
      const {
        kodeRt,
        kodeRw,
        namaKelurahan,
        namaKecamatan,
        namaKota,
        kodePos,
      } = (request.body as any) || {};

      if (!kodeRt || !kodeRw || !namaKelurahan || !namaKecamatan || !namaKota) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ErrorCode.ERR_VALIDATION,
            message: 'Kode RT, RW, Kelurahan, Kecamatan, dan Kota/Kabupaten wajib diisi.',
          },
          timestamp: new Date().toISOString(),
        });
      }

      const { publicKeyPem, privateKeyPem } = signerAdapter.generateKeyPair();
      const encryptedPrivateKey = cryptoAdapter.encryptField(privateKeyPem);

      const created = await prisma.rukunTetanggaConfig.create({
        data: {
          kodeRt: String(kodeRt).trim(),
          kodeRw: String(kodeRw).trim(),
          namaKelurahan: String(namaKelurahan).trim(),
          namaKecamatan: String(namaKecamatan).trim(),
          namaKota: String(namaKota).trim(),
          kodePos: kodePos ? String(kodePos).trim() : '00000',
          ed25519PublicKey: publicKeyPem,
          ed25519PrivateKeyEnc: encryptedPrivateKey,
        },
      });

      return reply.status(201).send({
        success: true,
        data: formatRt(created),
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * PUT /api/v1/config/rt and PUT /api/v1/config/rt/:id (Update RT Profile & Location)
   */
  const handleUpdateRt = async (request: any, reply: any) => {
    const {
      id: bodyId,
      kodeRt,
      kodeRw,
      namaKelurahan,
      namaKecamatan,
      namaKota,
      kodePos,
    } = (request.body as any) || {};

    const paramId = (request.params as any)?.id;
    const headerRtId = request.headers['x-rt-id'] as string | undefined;
    const targetId = paramId || bodyId || headerRtId;

    if (!kodeRt || !kodeRw || !namaKelurahan || !namaKecamatan || !namaKota) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ErrorCode.ERR_VALIDATION,
          message: 'Kode RT, RW, Kelurahan, Kecamatan, dan Kota/Kabupaten wajib diisi.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    let existingConfig;
    if (targetId) {
      existingConfig = await prisma.rukunTetanggaConfig.findUnique({
        where: { id: targetId },
      });
    }

    if (!existingConfig) {
      existingConfig = await prisma.rukunTetanggaConfig.findFirst({
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!existingConfig) {
      return reply.status(404).send({
        success: false,
        error: {
          code: ErrorCode.ERR_NOT_FOUND,
          message: 'Data RT yang hendak diubah tidak ditemukan.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    const updated = await prisma.rukunTetanggaConfig.update({
      where: { id: existingConfig.id },
      data: {
        kodeRt: String(kodeRt).trim(),
        kodeRw: String(kodeRw).trim(),
        namaKelurahan: String(namaKelurahan).trim(),
        namaKecamatan: String(namaKecamatan).trim(),
        namaKota: String(namaKota).trim(),
        kodePos: kodePos ? String(kodePos).trim() : existingConfig.kodePos,
      },
    });

    // Safely record audit log without blocking or failing on schema mismatch
    try {
      if ((prisma as any).securityAuditLog) {
        const lastLog = await (prisma as any).securityAuditLog.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { rowHash: true },
        });
        const prevHash = lastLog?.rowHash || '0000000000000000000000000000000000000000000000000000000000000000';
        const rowHash = crypto.createHash('sha256').update(prevHash + updated.id + 'UPDATE_RT_CONFIG').digest('hex');

        await (prisma as any).securityAuditLog.create({
          data: {
            actorUserId: request.userSession?.userId || 'system',
            actorRole: request.userSession?.role || 'SUPERUSER',
            actionType: 'UPDATE_RT_CONFIG',
            targetEntity: 'RUKUN_TETANGGA_CONFIG',
            targetId: updated.id,
            accessReason: `Pembaruan identitas RT menjadi RT ${updated.kodeRt}/RW ${updated.kodeRw} ${updated.namaKelurahan}`,
            ipAddress: request.ip || '127.0.0.1',
            userAgent: (request.headers['user-agent'] as string) || 'SIM-RT Web',
            prevHash,
            rowHash,
          },
        });
      }
    } catch {
      // Non-fatal audit log catch
    }

    return reply.send({
      success: true,
      data: formatRt(updated),
      timestamp: new Date().toISOString(),
    });
  };

  fastify.put(
    '/rt',
    { preHandler: [authenticateJwt, requireRoles([UserRole.SUPERUSER, UserRole.KETUA_RT])] },
    handleUpdateRt
  );

  fastify.put(
    '/rt/:id',
    { preHandler: [authenticateJwt, requireRoles([UserRole.SUPERUSER, UserRole.KETUA_RT])] },
    handleUpdateRt
  );
};
