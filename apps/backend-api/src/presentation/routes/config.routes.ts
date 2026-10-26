import type { FastifyPluginAsync } from 'fastify';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { authenticateJwt, requireRoles } from '../middlewares/auth.middleware.js';
import {
  UserRole,
  ErrorCode,
  PlanCode,
  TenantStatus,
  TenantSlugSchema,
  ensureUniqueSlug,
  slugifyTenantIdentity,
} from '@simrt/shared-types';
import { Ed25519SignerAdapter } from '../../infrastructure/crypto/ed25519-signer.adapter.js';
import { EnvelopeCryptoAdapter } from '../../infrastructure/crypto/envelope-crypto.adapter.js';
import { TenantContextService } from '../../infrastructure/tenant/tenant-context.service.js';
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
    const count = await prisma.rukunTetanggaConfig.count();
    if (count === 0) {
      // 1. Pangkalpinang
      const { publicKeyPem: pk1, privateKeyPem: sk1 } = signerAdapter.generateKeyPair();
      await prisma.rukunTetanggaConfig.create({
        data: {
          slug: slugifyTenantIdentity('010', '003', 'Taman Bunga', 'Kota Pangkalpinang'),
          kodeRt: '010',
          kodeRw: '003',
          namaKelurahan: 'Taman Bunga',
          namaKecamatan: 'Gerunggang',
          namaKota: 'Kota Pangkalpinang',
          kodePos: '33119',
          status: TenantStatus.ACTIVE,
          planCode: PlanCode.FREE,
          ed25519PublicKey: pk1,
          ed25519PrivateKeyEnc: cryptoAdapter.encryptField(sk1),
        },
      });

      // 2. Sukamaju Depok
      const { publicKeyPem: pk2, privateKeyPem: sk2 } = signerAdapter.generateKeyPair();
      await prisma.rukunTetanggaConfig.create({
        data: {
          slug: slugifyTenantIdentity('05', '02', 'Sukamaju', 'Kota Depok'),
          kodeRt: '05',
          kodeRw: '02',
          namaKelurahan: 'Sukamaju',
          namaKecamatan: 'Cilodong',
          namaKota: 'Kota Depok',
          kodePos: '16415',
          status: TenantStatus.ACTIVE,
          planCode: PlanCode.FREE,
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

    // Deduplicate by (kodeRt + kodeRw + namaKelurahan + namaKota)
    const seen = new Set<string>();
    const uniqueList = list.filter((item) => {
      const key = `${item.kodeRt}-${item.kodeRw}-${item.namaKelurahan}-${item.namaKota}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return reply.send({
      success: true,
      data: uniqueList.map(formatRt),
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

      const requestedSlug = (request.body as any)?.slug;

      // Identity must be unique: the SAME (RT, RW, kelurahan, kota) tuple denotes
      // one community. Without this check the registry accumulates duplicates —
      // which is exactly why the old read path needed a runtime dedupe filter.
      const duplicate = await prisma.rukunTetanggaConfig.findFirst({
        where: {
          kodeRt: String(kodeRt).trim(),
          kodeRw: String(kodeRw).trim(),
          namaKelurahan: String(namaKelurahan).trim(),
          namaKota: String(namaKota).trim(),
        },
        select: { id: true },
      });
      if (duplicate) {
        return reply.status(409).send({
          success: false,
          error: {
            code: ErrorCode.ERR_CONFLICT,
            message: `Komunitas RT ${kodeRt}/RW ${kodeRw} Kel. ${namaKelurahan} ${namaKota} sudah terdaftar.`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Slug: honour an explicit client value when it is valid and free,
      // otherwise derive one deterministically from the civic identity.
      const existingSlugs = (
        await prisma.rukunTetanggaConfig.findMany({ select: { slug: true } })
      ).map((r) => r.slug);

      let slug: string;
      if (requestedSlug && typeof requestedSlug === 'string') {
        const parsed = TenantSlugSchema.safeParse(requestedSlug);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            error: { code: ErrorCode.ERR_VALIDATION, message: parsed.error.issues[0].message },
            timestamp: new Date().toISOString(),
          });
        }
        if (existingSlugs.includes(parsed.data)) {
          return reply.status(409).send({
            success: false,
            error: { code: ErrorCode.ERR_TENANT_SLUG_TAKEN, message: 'Slug tersebut sudah digunakan.' },
            timestamp: new Date().toISOString(),
          });
        }
        slug = parsed.data;
      } else {
        slug = ensureUniqueSlug(
          slugifyTenantIdentity(
            String(kodeRt).trim(),
            String(kodeRw).trim(),
            String(namaKelurahan).trim(),
            String(namaKota).trim()
          ),
          existingSlugs
        );
      }

      const { publicKeyPem, privateKeyPem } = signerAdapter.generateKeyPair();
      const encryptedPrivateKey = cryptoAdapter.encryptField(privateKeyPem);

      const created = await prisma.rukunTetanggaConfig.create({
        data: {
          slug,
          kodeRt: String(kodeRt).trim(),
          kodeRw: String(kodeRw).trim(),
          namaKelurahan: String(namaKelurahan).trim(),
          namaKecamatan: String(namaKecamatan).trim(),
          namaKota: String(namaKota).trim(),
          kodePos: kodePos ? String(kodePos).trim() : '00000',
          status: TenantStatus.ACTIVE,
          planCode: PlanCode.FREE,
          ed25519PublicKey: publicKeyPem,
          ed25519PrivateKeyEnc: encryptedPrivateKey,
        },
      });

      // The resolver caches tenant rows briefly; drop the entry so the new
      // community is usable immediately instead of after the TTL.
      TenantContextService.invalidate();

      return reply.status(201).send({
        success: true,
        data: { ...formatRt(created), slug: created.slug },
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

  fastify.delete(
    '/rt/:id',
    { preHandler: [authenticateJwt, requireRoles([UserRole.SUPERUSER])] },
    async (request, reply) => {
      const { id } = request.params as any;
      const count = await prisma.rukunTetanggaConfig.count();
      if (count <= 1) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ErrorCode.ERR_VALIDATION,
            message: 'Minimal harus ada 1 komunitas RT aktif dalam sistem.',
          },
          timestamp: new Date().toISOString(),
        });
      }

      await prisma.rukunTetanggaConfig.delete({
        where: { id },
      }).catch(() => {});

      return reply.send({
        success: true,
        data: { id, deleted: true },
        timestamp: new Date().toISOString(),
      });
    }
  );
};

