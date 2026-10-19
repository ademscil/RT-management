import type { FastifyPluginAsync } from 'fastify';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { HashChainService } from '../../infrastructure/ledger/hash-chain.service.js';
import type { SSEBrokerService } from '../../infrastructure/realtime/sse-broker.service.js';
import {
  GenerateTagihanBulananSchema,
  VerifikasiIuranSchema,
  CatatKasKeluarSchema,
  TagihanQueryFilterSchema,
  KasLedgerQueryFilterSchema,
  buildPaginationMeta,
  ErrorCode,
  UserRole,
  StatusTagihanIuran,
  TipeTransaksiKas,
  NotificationCategory,
  NotificationPriority,
} from '@simrt/shared-types';
import { authenticateJwt, requireRoles } from '../middlewares/auth.middleware.js';

export const keuanganRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = PrismaService.getInstance();
  const hashChainService = new HashChainService();
  const sseBroker = (fastify as any).sseBroker as SSEBrokerService;

  fastify.addHook('preHandler', authenticateJwt);

  /**
   * GET /api/v1/keuangan/matriks (12-Month Billing Matrix per House)
   */
  fastify.get(
    '/matriks',
    { preHandler: [requireRoles([UserRole.KETUA_RT, UserRole.BENDAHARA, UserRole.SEKRETARIS])] },
    async (request, reply) => {
      const { tahun = new Date().getFullYear() } = request.query as { tahun?: number };
      const selectedYear = Number(tahun);

      const houses = await prisma.rumahKavling.findMany({
        orderBy: { kodeBlok: 'asc' },
        include: {
          kartuKeluarga: {
            include: {
              warga: true,
              tagihanIuran: {
                where: { tahun: selectedYear },
              },
            },
          },
        },
      });

      const matrix = houses.map((h) => {
        const primaryKk = h.kartuKeluarga[0];
        const kepalaKeluarga =
          primaryKk?.warga.find((w) => w.hubunganKeluarga === 'KEPALA_KELUARGA')?.namaLengkap ||
          primaryKk?.warga[0]?.namaLengkap ||
          '-';

        const monthsStatus: Record<number, string> = {};
        for (let m = 1; m <= 12; m++) {
          const bill = primaryKk?.tagihanIuran.find((b) => b.bulan === m);
          monthsStatus[m] = bill ? bill.status : 'NO_BILL';
        }

        return {
          rumahId: h.id,
          kodeBlok: h.kodeBlok,
          nomorRumah: h.nomorRumah,
          alamat: h.alamat,
          kepalaKeluarga,
          statusHunian: h.statusHunian,
          tahun: selectedYear,
          bulan: monthsStatus,
        };
      });

      return reply.send({
        success: true,
        data: matrix,
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * GET /api/v1/keuangan/tagihan (Paginated List of Bills with Status & Search)
   */
  fastify.get('/tagihan', async (request, reply) => {
    const parseResult = TagihanQueryFilterSchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.errors[0].message },
        timestamp: new Date().toISOString(),
      });
    }

    const { page, limit, status, bulan, tahun, search } = parseResult.data;
    const session = request.userSession!;

    const where: Record<string, unknown> = {};
    if (session.role === UserRole.WARGA) {
      where.kkId = session.kkId;
    }

    if (status) where.status = status;
    if (bulan) where.bulan = bulan;
    if (tahun) where.tahun = tahun;

    if (search) {
      where.rumah = {
        OR: [
          { kodeBlok: { contains: search, mode: 'insensitive' } },
          { nomorRumah: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.tagihanIuran.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ tahun: 'desc' }, { bulan: 'desc' }],
        include: {
          rumah: true,
          kk: {
            include: {
              warga: true,
            },
          },
        },
      }),
      prisma.tagihanIuran.count({ where }),
    ]);

    const formatted = items.map((t) => ({
      id: t.id,
      rumahId: t.rumahId,
      blokRumah: `${t.rumah.kodeBlok} No. ${t.rumah.nomorRumah}`,
      alamat: t.rumah.alamat,
      bulan: t.bulan,
      tahun: t.tahun,
      nominal: Number(t.nominal),
      status: t.status,
      buktiBayarMinioKey: t.buktiBayarMinioKey,
      alasanPenolakan: t.alasanPenolakan,
      paidAt: t.paidAt?.toISOString(),
      kepalaKeluarga:
        t.kk.warga.find((w) => w.hubunganKeluarga === 'KEPALA_KELUARGA')?.namaLengkap || t.kk.warga[0]?.namaLengkap || '-',
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
   * POST /api/v1/keuangan/generate-bulanan (Batch generate monthly bills for all houses)
   */
  fastify.post(
    '/generate-bulanan',
    { preHandler: [requireRoles([UserRole.BENDAHARA, UserRole.KETUA_RT])] },
    async (request, reply) => {
      const parseResult = GenerateTagihanBulananSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.errors[0].message },
          timestamp: new Date().toISOString(),
        });
      }

      const { bulan, tahun, nominalDefault } = parseResult.data;

      const houses = await prisma.rumahKavling.findMany({
        where: {
          statusHunian: { in: ['DIHUNI_PEMILIK', 'DIHUNI_PENYEWA'] },
        },
        include: { kartuKeluarga: true },
      });

      let generatedCount = 0;
      for (const h of houses) {
        const kk = h.kartuKeluarga[0];
        if (!kk) continue;

        const existing = await prisma.tagihanIuran.findFirst({
          where: { rumahId: h.id, bulan, tahun },
        });

        if (!existing) {
          await prisma.tagihanIuran.create({
            data: {
              rumahId: h.id,
              kkId: kk.id,
              bulan,
              tahun,
              nominal: BigInt(nominalDefault),
              status: StatusTagihanIuran.UNPAID,
            },
          });
          generatedCount++;
        }
      }

      // Notify residents via SSE
      sseBroker.broadcast('notification', {
        id: `TAGIHAN-${Date.now()}`,
        title: `Tagihan Iuran Periode ${bulan}/${tahun} Telah Terbit`,
        message: `Tagihan iuran RT sebesar Rp ${nominalDefault.toLocaleString('id-ID')} telah diterbitkan. Silakan melakukan pembayaran sebelum tanggal 10.`,
        category: NotificationCategory.IURAN,
        priority: NotificationPriority.NORMAL,
        deepLink: '/iuran',
        createdAt: new Date().toISOString(),
      });

      return reply.send({
        success: true,
        data: {
          bulan,
          tahun,
          nominalDefault,
          totalTagihanDibuat: generatedCount,
        },
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * POST /api/v1/keuangan/verifikasi (Treasurer approves fee proof & generates Immutable Kas entry)
   */
  fastify.post(
    '/verifikasi',
    { preHandler: [requireRoles([UserRole.BENDAHARA, UserRole.KETUA_RT])] },
    async (request, reply) => {
      const parseResult = VerifikasiIuranSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.errors[0].message },
          timestamp: new Date().toISOString(),
        });
      }

      const { tagihanId, isApproved, alasanPenolakan } = parseResult.data;
      const user = request.userSession!;

      const tagihan = await prisma.tagihanIuran.findUnique({
        where: { id: tagihanId },
        include: {
          rumah: true,
          kk: { include: { warga: { include: { users: true } } } },
        },
      });

      if (!tagihan) {
        return reply.status(404).send({
          success: false,
          error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Tagihan tidak ditemukan.' },
          timestamp: new Date().toISOString(),
        });
      }

      if (!isApproved) {
        await prisma.tagihanIuran.update({
          where: { id: tagihanId },
          data: {
            status: StatusTagihanIuran.REJECTED,
            alasanPenolakan: alasanPenolakan || 'Bukti bayar tidak terbaca / tidak sesuai.',
            verifiedByUserId: user.userId,
          },
        });

        return reply.send({
          success: true,
          data: { status: StatusTagihanIuran.REJECTED },
          timestamp: new Date().toISOString(),
        });
      }

      // Approved: 1. Update tagihan 2. Insert into Kas Ledger with Hash-Chaining
      const posOperasional = await prisma.posKeuangan.findFirst({
        where: { kodePosKas: 'POS-OPS' },
      });

      if (!posOperasional) {
        return reply.status(500).send({
          success: false,
          error: { code: ErrorCode.ERR_INTERNAL, message: 'Pos kas operasional tidak ditemukan.' },
          timestamp: new Date().toISOString(),
        });
      }

      const lastKas = await prisma.kasLedgerImmutable.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      const prevHash = lastKas ? lastKas.rowHash : HashChainService.GENESIS_HASH;
      const timestampIso = new Date().toISOString();
      const kasId = `KAS-IN-${Date.now()}`;
      const actionOrNominal = `IN:${tagihan.nominal.toString()}`;

      const rowHash = hashChainService.computeRowHash(
        prevHash,
        kasId,
        user.userId,
        actionOrNominal,
        timestampIso
      );

      const saldoBaru = posOperasional.saldoBerjalan + tagihan.nominal;

      await prisma.$transaction([
        prisma.tagihanIuran.update({
          where: { id: tagihanId },
          data: {
            status: StatusTagihanIuran.PAID,
            paidAt: new Date(),
            verifiedByUserId: user.userId,
          },
        }),
        prisma.posKeuangan.update({
          where: { id: posOperasional.id },
          data: { saldoBerjalan: saldoBaru },
        }),
        prisma.kasLedgerImmutable.create({
          data: {
            id: kasId,
            posKeuanganId: posOperasional.id,
            tipe: TipeTransaksiKas.IN,
            nominal: tagihan.nominal,
            saldoSetelah: saldoBaru,
            deskripsi: `Penerimaan Iuran Warga Blok ${tagihan.rumah.kodeBlok}/${tagihan.rumah.nomorRumah} Periode ${tagihan.bulan}/${tagihan.tahun}`,
            createdByUserId: user.userId,
            approvedByUserId: user.userId,
            prevHash,
            rowHash,
            createdAt: new Date(timestampIso),
          },
        }),
      ]);

      // Notify resident
      const residentUser = tagihan.kk.warga.find((w) => w.users)?.users;
      if (residentUser) {
        sseBroker.emitToUser(residentUser.id, 'notification', {
          id: `NOTIF-${Date.now()}`,
          title: 'Iuran Berhasil Diverifikasi',
          message: `Pembayaran iuran periode ${tagihan.bulan}/${tagihan.tahun} telah diverifikasi Bendahara RT. Kwitansi digital siap diunduh.`,
          category: NotificationCategory.IURAN,
          priority: NotificationPriority.NORMAL,
          deepLink: `/iuran/${tagihan.id}`,
          createdAt: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: {
          tagihanId: tagihan.id,
          status: StatusTagihanIuran.PAID,
          ledgerHash: rowHash,
        },
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * GET /api/v1/keuangan/ledger (Immutable Cash Ledger with Pagination & Filters)
   */
  fastify.get('/ledger', async (request, reply) => {
    const parseResult = KasLedgerQueryFilterSchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.errors[0].message },
        timestamp: new Date().toISOString(),
      });
    }

    const { page, limit, posKeuanganId, tipe } = parseResult.data;

    const where: Record<string, unknown> = {};
    if (posKeuanganId) where.posKeuanganId = posKeuanganId;
    if (tipe) where.tipe = tipe;

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.kasLedgerImmutable.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { posKeuangan: true },
      }),
      prisma.kasLedgerImmutable.count({ where }),
    ]);

    const formatted = items.map((k) => ({
      id: k.id,
      namaPos: k.posKeuangan.namaPos,
      tipe: k.tipe,
      nominal: Number(k.nominal),
      saldoSetelah: Number(k.saldoSetelah),
      deskripsi: k.deskripsi,
      prevHash: k.prevHash,
      rowHash: k.rowHash,
      createdAt: k.createdAt.toISOString(),
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
   * POST /api/v1/keuangan/catat-pengeluaran (Record Cash Expense with Hash Chaining)
   */
  fastify.post(
    '/catat-pengeluaran',
    { preHandler: [requireRoles([UserRole.BENDAHARA, UserRole.KETUA_RT])] },
    async (request, reply) => {
      const parseResult = CatatKasKeluarSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.errors[0].message },
          timestamp: new Date().toISOString(),
        });
      }

      const { posKeuanganId, nominal, deskripsi } = parseResult.data;
      const user = request.userSession!;

      const pos = await prisma.posKeuangan.findUnique({ where: { id: posKeuanganId } });
      if (!pos) {
        return reply.status(404).send({
          success: false,
          error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Pos keuangan tidak ditemukan.' },
          timestamp: new Date().toISOString(),
        });
      }

      const nominalBig = BigInt(nominal);
      if (pos.saldoBerjalan < nominalBig) {
        return reply.status(400).send({
          success: false,
          error: { code: ErrorCode.ERR_VALIDATION, message: 'Saldo pos keuangan tidak mencukupi untuk pengeluaran ini.' },
          timestamp: new Date().toISOString(),
        });
      }

      const lastKas = await prisma.kasLedgerImmutable.findFirst({ orderBy: { createdAt: 'desc' } });
      const prevHash = lastKas ? lastKas.rowHash : HashChainService.GENESIS_HASH;
      const timestampIso = new Date().toISOString();
      const kasId = `KAS-OUT-${Date.now()}`;
      const actionOrNominal = `OUT:${nominalBig.toString()}`;

      const rowHash = hashChainService.computeRowHash(
        prevHash,
        kasId,
        user.userId,
        actionOrNominal,
        timestampIso
      );

      const saldoBaru = pos.saldoBerjalan - nominalBig;

      await prisma.$transaction([
        prisma.posKeuangan.update({
          where: { id: posKeuanganId },
          data: { saldoBerjalan: saldoBaru },
        }),
        prisma.kasLedgerImmutable.create({
          data: {
            id: kasId,
            posKeuanganId,
            tipe: TipeTransaksiKas.OUT,
            nominal: nominalBig,
            saldoSetelah: saldoBaru,
            deskripsi,
            createdByUserId: user.userId,
            approvedByUserId: user.userId,
            prevHash,
            rowHash,
            createdAt: new Date(timestampIso),
          },
        }),
      ]);

      return reply.send({
        success: true,
        data: { id: kasId, rowHash, saldoBaru: Number(saldoBaru) },
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * GET /api/v1/keuangan/verify-integrity (Cryptographic Mathematical Audit of the entire Ledger)
   */
  fastify.get(
    '/verify-integrity',
    { preHandler: [requireRoles([UserRole.KETUA_RT, UserRole.BENDAHARA, UserRole.SEKRETARIS])] },
    async (_request, reply) => {
      const records = await prisma.kasLedgerImmutable.findMany({
        orderBy: { createdAt: 'asc' },
      });

      const mappedRecords = records.map((r) => ({
        id: r.id,
        actorId: r.createdByUserId,
        actionOrNominal: `${r.tipe}:${r.nominal.toString()}`,
        timestampIso: r.createdAt.toISOString(),
        prevHash: r.prevHash,
        rowHash: r.rowHash,
      }));

      const verificationResult = hashChainService.verifyChain(mappedRecords);

      return reply.send({
        success: true,
        data: verificationResult,
        timestamp: new Date().toISOString(),
      });
    }
  );
};
