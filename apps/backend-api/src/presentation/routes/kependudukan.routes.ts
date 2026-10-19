import type { FastifyPluginAsync } from 'fastify';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { EnvelopeCryptoAdapter } from '../../infrastructure/crypto/envelope-crypto.adapter.js';
import { HmacBlindIndexAdapter } from '../../infrastructure/crypto/blind-index.adapter.js';
import { HashChainService } from '../../infrastructure/ledger/hash-chain.service.js';
import {
  WargaQueryFilterSchema,
  RevealPiiRequestSchema,
  WargaCreateSchema,
  buildPaginationMeta,
  ErrorCode,
  UserRole,
} from '@simrt/shared-types';
import { authenticateJwt, requireRoles } from '../middlewares/auth.middleware.js';
import { PiiCircuitBreaker } from '../middlewares/circuit-breaker.middleware.js';

export const kependudukanRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = PrismaService.getInstance();
  const cryptoAdapter = new EnvelopeCryptoAdapter();
  const blindIndexAdapter = new HmacBlindIndexAdapter();
  const hashChainService = new HashChainService();

  fastify.addHook('preHandler', authenticateJwt);

  /**
   * GET /api/v1/kependudukan/warga (Server-side Pagination, Debounced Search & Vulnerability Filters)
   */
  fastify.get('/warga', async (request, reply) => {
    const parseResult = WargaQueryFilterSchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ErrorCode.ERR_VALIDATION,
          message: parseResult.error.errors[0].message,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const { page, limit, search, sortBy, sortOrder, golonganDarah, isLansia, isDisabilitas, isBalita, isIbuHamil, statusKependudukan } =
      parseResult.data;

    const session = request.userSession!;

    // Query builder with RLS session awareness
    const where: Record<string, unknown> = {};

    // If resident, restrict to own KK
    if (session.role === UserRole.WARGA) {
      where.kkId = session.kkId;
    }

    // Search filter across namaLengkap or nikMasked
    if (search) {
      where.OR = [
        { namaLengkap: { contains: search, mode: 'insensitive' } },
        { nikMasked: { contains: search } },
      ];
    }

    // Demographic filters
    if (golonganDarah) where.golonganDarah = golonganDarah;
    if (isLansia !== undefined) where.isLansia = isLansia;
    if (isDisabilitas !== undefined) where.isDisabilitas = isDisabilitas;
    if (isBalita !== undefined) where.isBalita = isBalita;
    if (isIbuHamil !== undefined) where.isIbuHamil = isIbuHamil;
    if (statusKependudukan) where.statusKependudukan = statusKependudukan;

    const skip = (page - 1) * limit;
    const orderBy: Record<string, string> = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    const [items, total] = await Promise.all([
      prisma.warga.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          kk: {
            include: {
              rumah: true,
            },
          },
        },
      }),
      prisma.warga.count({ where }),
    ]);

    const sanitizedItems = items.map((w) => ({
      id: w.id,
      namaLengkap: w.namaLengkap,
      nikMasked: w.nikMasked,
      tempatLahir: w.tempatLahir,
      tanggalLahir: w.tanggalLahir,
      gender: w.gender,
      golonganDarah: w.golonganDarah,
      agama: w.agama,
      pekerjaan: w.pekerjaan,
      statusPerkawinan: w.statusPerkawinan,
      hubunganKeluarga: w.hubunganKeluarga,
      statusKependudukan: w.statusKependudukan,
      isLansia: w.isLansia,
      isDisabilitas: w.isDisabilitas,
      isBalita: w.isBalita,
      isIbuHamil: w.isIbuHamil,
      blokRumah: `${w.kk.rumah.kodeBlok} No. ${w.kk.rumah.nomorRumah}`,
      alamatDomisili: w.kk.rumah.alamat,
      statusVerifikasiKk: w.kk.statusVerifikasi,
    }));

    return reply.send({
      success: true,
      data: {
        items: sanitizedItems,
        meta: buildPaginationMeta(total, page, limit),
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /api/v1/kependudukan/kk (Server-side Pagination & Search for Kartu Keluarga)
   */
  fastify.get('/kk', async (request, reply) => {
    const session = request.userSession!;
    const { page = 1, limit = 10, search } = request.query as { page?: number; limit?: number; search?: string };

    const safePage = Math.max(1, Number(page));
    const safeLimit = Math.min(100, Math.max(1, Number(limit)));
    const skip = (safePage - 1) * safeLimit;

    const where: Record<string, unknown> = {};
    if (session.role === UserRole.WARGA) {
      where.id = session.kkId;
    }

    if (search) {
      where.OR = [
        { noKkMasked: { contains: search } },
        { rumah: { alamat: { contains: search, mode: 'insensitive' } } },
        { rumah: { kodeBlok: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.kartuKeluarga.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          rumah: true,
          warga: true,
        },
      }),
      prisma.kartuKeluarga.count({ where }),
    ]);

    const sanitizedKk = items.map((kk) => ({
      id: kk.id,
      noKkMasked: kk.noKkMasked,
      blokRumah: `${kk.rumah.kodeBlok} No. ${kk.rumah.nomorRumah}`,
      alamatDomisili: kk.rumah.alamat,
      statusDomisili: kk.statusDomisili,
      statusVerifikasi: kk.statusVerifikasi,
      catatanRevisi: kk.catatanRevisi,
      jumlahAnggota: kk.warga.length,
      kepalaKeluarga: kk.warga.find((w) => w.hubunganKeluarga === 'KEPALA_KELUARGA')?.namaLengkap || kk.warga[0]?.namaLengkap || '-',
    }));

    return reply.send({
      success: true,
      data: {
        items: sanitizedKk,
        meta: buildPaginationMeta(total, safePage, safeLimit),
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /api/v1/kependudukan/map (Interactive Block Map data with Vulnerability Flags)
   */
  fastify.get('/map', async (_request, reply) => {
    const houses = await prisma.rumahKavling.findMany({
      orderBy: { kodeBlok: 'asc' },
      include: {
        kartuKeluarga: {
          include: {
            warga: true,
            tagihanIuran: {
              where: {
                bulan: new Date().getMonth() + 1,
                tahun: new Date().getFullYear(),
              },
            },
          },
        },
      },
    });

    const mapData = houses.map((h) => {
      const allWarga = h.kartuKeluarga.flatMap((kk) => kk.warga);
      const currentBill = h.kartuKeluarga.flatMap((kk) => kk.tagihanIuran)[0];

      const hasLansia = allWarga.some((w) => w.isLansia);
      const hasDisabilitas = allWarga.some((w) => w.isDisabilitas);
      const hasBalita = allWarga.some((w) => w.isBalita);
      const hasIbuHamil = allWarga.some((w) => w.isIbuHamil);

      return {
        id: h.id,
        kodeBlok: h.kodeBlok,
        nomorRumah: h.nomorRumah,
        alamat: h.alamat,
        gridX: h.gridX,
        gridY: h.gridY,
        statusHunian: h.statusHunian,
        iuranStatus: currentBill ? currentBill.status : 'NO_BILL',
        totalPenghuni: allWarga.length,
        vulnerabilities: {
          hasLansia,
          hasDisabilitas,
          hasBalita,
          hasIbuHamil,
          anyVulnerability: hasLansia || hasDisabilitas || hasBalita || hasIbuHamil,
        },
        kepalaKeluarga: allWarga.find((w) => w.hubunganKeluarga === 'KEPALA_KELUARGA')?.namaLengkap || '-',
      };
    });

    return reply.send({
      success: true,
      data: mapData,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /api/v1/kependudukan/reveal-pii (Protected by PII Scraping Circuit Breaker + Hash Chain Audit Log)
   */
  fastify.post(
    '/reveal-pii',
    {
      preHandler: [
        requireRoles([UserRole.KETUA_RT, UserRole.SEKRETARIS, UserRole.BENDAHARA]),
        PiiCircuitBreaker.createMiddleware((fastify as any).sseBroker),
      ],
    },
    async (request, reply) => {
      const parseResult = RevealPiiRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ErrorCode.ERR_VALIDATION,
            message: parseResult.error.errors[0].message,
          },
          timestamp: new Date().toISOString(),
        });
      }

      const { wargaId, field, reason } = parseResult.data;
      const user = request.userSession!;

      const targetWarga = await prisma.warga.findUnique({
        where: { id: wargaId },
        include: { kk: true },
      });

      if (!targetWarga) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ErrorCode.ERR_NOT_FOUND,
            message: 'Data warga tidak ditemukan.',
          },
          timestamp: new Date().toISOString(),
        });
      }

      let revealedValue = '';
      if (field === 'NIK') {
        revealedValue = cryptoAdapter.decryptField(targetWarga.nikEncrypted);
      } else if (field === 'NO_KK') {
        revealedValue = cryptoAdapter.decryptField(targetWarga.kk.noKkEncrypted);
      } else {
        return reply.status(400).send({
          success: false,
          error: { code: ErrorCode.ERR_VALIDATION, message: 'Field PII tidak didukung via endpoint ini.' },
          timestamp: new Date().toISOString(),
        });
      }

      // Record in Hash-Chained Security Audit Log
      const lastLog = await prisma.securityAuditLog.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      const prevHash = lastLog ? lastLog.rowHash : HashChainService.GENESIS_HASH;
      const auditId = `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const timestampIso = new Date().toISOString();
      const actionType = `REVEAL_PII_${field}`;

      const rowHash = hashChainService.computeRowHash(
        prevHash,
        auditId,
        user.userId,
        `${actionType}:${wargaId}:${reason}`,
        timestampIso
      );

      await prisma.securityAuditLog.create({
        data: {
          id: auditId,
          actorUserId: user.userId,
          actorRole: user.role,
          actionType,
          targetEntity: 'WARGA',
          targetId: wargaId,
          accessReason: reason,
          ipAddress: request.ip || '127.0.0.1',
          userAgent: request.headers['user-agent'] || 'Unknown',
          prevHash,
          rowHash,
          createdAt: new Date(timestampIso),
        },
      });

      return reply.send({
        success: true,
        data: {
          field,
          value: revealedValue,
          auditId,
          accessReason: reason,
        },
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * POST /api/v1/kependudukan/warga (Add new Warga)
   */
  fastify.post(
    '/warga',
    { preHandler: [requireRoles([UserRole.KETUA_RT, UserRole.SEKRETARIS])] },
    async (request, reply) => {
      const rawBody = request.body as any;
      if (!rawBody?.kkId) {
        return reply.status(400).send({
          success: false,
          error: { code: ErrorCode.ERR_VALIDATION, message: 'kkId wajib disertakan.' },
          timestamp: new Date().toISOString(),
        });
      }

      const input = WargaCreateSchema.parse(rawBody);
      const blindIndex = blindIndexAdapter.computeBlindIndex(input.nik);

      const existing = await prisma.warga.findUnique({ where: { nikBlindIndex: blindIndex } });
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: { code: ErrorCode.ERR_CONFLICT, message: 'NIK sudah terdaftar dalam sistem.' },
          timestamp: new Date().toISOString(),
        });
      }

      const created = await prisma.warga.create({
        data: {
          kkId: rawBody.kkId,
          namaLengkap: input.namaLengkap,
          nikEncrypted: cryptoAdapter.encryptField(input.nik),
          nikBlindIndex: blindIndex,
          nikMasked: blindIndexAdapter.maskNik(input.nik),
          tempatLahir: input.tempatLahir,
          tanggalLahir: input.tanggalLahir,
          gender: input.gender,
          golonganDarah: input.golonganDarah,
          agama: input.agama,
          pendidikanTerakhir: input.pendidikanTerakhir,
          pekerjaan: input.pekerjaan,
          statusPerkawinan: input.statusPerkawinan,
          hubunganKeluarga: input.hubunganKeluarga,
          statusKependudukan: input.statusKependudukan,
          isLansia: input.isLansia,
          isDisabilitas: input.isDisabilitas,
          isBalita: input.isBalita,
          isIbuHamil: input.isIbuHamil,
        },
      });

      return reply.send({
        success: true,
        data: { id: created.id, namaLengkap: created.namaLengkap, nikMasked: created.nikMasked },
        timestamp: new Date().toISOString(),
      });
    }
  );
};
