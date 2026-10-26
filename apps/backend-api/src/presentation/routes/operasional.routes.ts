import type { FastifyPluginAsync } from 'fastify';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  BuatJadwalRondaSchema,
  TambahInventarisSchema,
  PinjamInventarisSchema,
  BuatTiketAduanSchema,
  TiketAduanQueryFilterSchema,
  buildPaginationMeta,
  ErrorCode,
  UserRole,
  StatusAduan,
  StatusPeminjaman,
} from '@simrt/shared-types';
import { authenticateJwt, requireRoles } from '../middlewares/auth.middleware.js';
import {
  getRtId,
  getTenantContext,
  resolveTenantContext,
} from '../middlewares/tenant.middleware.js';

export const operasionalRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = PrismaService.getInstance();
  fastify.addHook('preHandler', authenticateJwt);
  fastify.addHook('preHandler', resolveTenantContext);

  /**
   * GET /api/v1/operasional/ronda
   */
  fastify.get('/ronda', async (request, reply) => {
    const rtId = getRtId(request);

    const schedules = await prisma.jadwalRonda.findMany({
      where: { rtId },
      orderBy: { tanggal: 'asc' },
      take: 30,
    });

    const wargaList = await prisma.warga.findMany({
      where: { rtId },
      select: { id: true, namaLengkap: true, nikMasked: true },
    });
    const wargaMap = new Map(wargaList.map((w) => [w.id, w.namaLengkap]));

    const formatted = schedules.map((s) => {
      const ids: string[] = JSON.parse(s.pesertaWargaIds || '[]');
      const namaPeserta = ids.map((id) => wargaMap.get(id) || 'Warga');
      return {
        id: s.id,
        tanggal: s.tanggal,
        shift: s.shift,
        keterangan: s.keterangan,
        pesertaWarga: namaPeserta,
      };
    });

    return reply.send({
      success: true,
      data: formatted,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /api/v1/operasional/ronda
   */
  fastify.post(
    '/ronda',
    { preHandler: [requireRoles([UserRole.KETUA_RT, UserRole.SEKRETARIS])] },
    async (request, reply) => {
      const parseResult = BuatJadwalRondaSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.issues[0].message },
          timestamp: new Date().toISOString(),
        });
      }

      const { tanggal, shift, pesertaWargaIds, keterangan } = parseResult.data;

      const created = await prisma.jadwalRonda.create({
        data: {
          rtId: getRtId(request),
          tanggal,
          shift,
          pesertaWargaIds: JSON.stringify(pesertaWargaIds),
          keterangan: keterangan || null,
        },
      });

      return reply.send({
        success: true,
        data: created,
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * GET /api/v1/operasional/inventaris
   */
  fastify.get('/inventaris', async (request, reply) => {
    const items = await prisma.inventarisRt.findMany({
      where: { rtId: getRtId(request) },
      orderBy: { namaBarang: 'asc' },
      include: {
        peminjaman: {
          where: { status: StatusPeminjaman.APPROVED },
        },
      },
    });

    const formatted = items.map((i) => {
      const dipinjam = i.peminjaman.reduce((acc, p) => acc + p.jumlah, 0);
      const tersedia = Math.max(0, i.kondisiBaik - dipinjam);
      return {
        id: i.id,
        kodeBarang: i.kodeBarang,
        namaBarang: i.namaBarang,
        kategori: i.kategori,
        jumlahTotal: i.jumlahTotal,
        kondisiBaik: i.kondisiBaik,
        sedangDipinjam: dipinjam,
        tersedia,
        lokasiPenyimpanan: i.lokasiPenyimpanan,
      };
    });

    return reply.send({
      success: true,
      data: formatted,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /api/v1/operasional/inventaris
   */
  fastify.post(
    '/inventaris',
    { preHandler: [requireRoles([UserRole.KETUA_RT, UserRole.SEKRETARIS, UserRole.BENDAHARA])] },
    async (request, reply) => {
      const parseResult = TambahInventarisSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.issues[0].message },
          timestamp: new Date().toISOString(),
        });
      }

      const created = await prisma.inventarisRt.create({
        data: {
          ...parseResult.data,
          rtId: getRtId(request),
        },
      });

      return reply.send({
        success: true,
        data: created,
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * POST /api/v1/operasional/inventaris/pinjam
   */
  fastify.post('/inventaris/pinjam', async (request, reply) => {
    const parseResult = PinjamInventarisSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.issues[0].message },
        timestamp: new Date().toISOString(),
      });
    }

    const { inventarisId, jumlah, tanggalPinjam, tanggalRencanaKembali, keperluan } = parseResult.data;
    const session = request.userSession!;
    const tenant = getTenantContext(request);

    const item = await prisma.inventarisRt.findUnique({ where: { id: inventarisId } });
    // Anti-IDOR: an item belonging to another RT is reported as not found.
    if (!item || item.rtId !== tenant.rtId) {
      return reply.status(404).send({
        success: false,
        error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Barang inventaris tidak ditemukan.' },
        timestamp: new Date().toISOString(),
      });
    }

    const created = await prisma.peminjamanInventaris.create({
      data: {
        rtId: tenant.rtId,
        inventarisId,
        peminjamWargaId: session.wargaId,
        jumlah,
        tanggalPinjam,
        tanggalRencanaKembali,
        keperluan,
        status: StatusPeminjaman.PENDING,
      },
    });

    return reply.send({
      success: true,
      data: created,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /api/v1/operasional/aduan (Paginated Community Complaint Tickets)
   */
  fastify.get('/aduan', async (request, reply) => {
    const parseResult = TiketAduanQueryFilterSchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.issues[0].message },
        timestamp: new Date().toISOString(),
      });
    }

    const { page, limit, status, search } = parseResult.data;
    const session = request.userSession!;

    // TENANT SCOPE — previously this listed complaint tickets from every RT.
    const where: Record<string, unknown> = { rtId: getRtId(request) };
    if (session.role === UserRole.WARGA) {
      where.pelaporWargaId = session.wargaId;
    }
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { judul: { contains: search, mode: 'insensitive' } },
        { deskripsi: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.tiketAduan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { pelaporWarga: true },
      }),
      prisma.tiketAduan.count({ where }),
    ]);

    const formatted = items.map((a) => ({
      id: a.id,
      kategori: a.kategori,
      judul: a.judul,
      deskripsi: a.deskripsi,
      status: a.status,
      pelaporNama: a.pelaporWarga.namaLengkap,
      tanggapanPengurus: a.tanggapanPengurus,
      createdAt: a.createdAt.toISOString(),
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
   * POST /api/v1/operasional/aduan (Resident submits complaint)
   */
  fastify.post('/aduan', async (request, reply) => {
    const parseResult = BuatTiketAduanSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.issues[0].message },
        timestamp: new Date().toISOString(),
      });
    }

    const { kategori, judul, deskripsi } = parseResult.data;
    const session = request.userSession!;

    const created = await prisma.tiketAduan.create({
      data: {
        rtId: getRtId(request),
        pelaporWargaId: session.wargaId,
        kategori,
        judul,
        deskripsi,
        status: StatusAduan.OPEN,
      },
    });

    return reply.send({
      success: true,
      data: created,
      timestamp: new Date().toISOString(),
    });
  });
};

