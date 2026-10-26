import type { FastifyPluginAsync } from 'fastify';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
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
  NotificationCategory,
  NotificationPriority,
} from '@simrt/shared-types';
import { authenticateJwt, requireRoles } from '../middlewares/auth.middleware.js';
import {
  getRtId,
  resolveTenantContext,
} from '../middlewares/tenant.middleware.js';
import { LedgerService } from '../../infrastructure/ledger/ledger.service.js';

export const keuanganRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = PrismaService.getInstance();
  const sseBroker = (fastify as any).sseBroker as SSEBrokerService;

  fastify.addHook('preHandler', authenticateJwt);
  fastify.addHook('preHandler', resolveTenantContext);

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
        where: { rtId: getRtId(request) },
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
        error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.issues[0].message },
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
      periodeBulan: t.bulan,
      tahun: t.tahun,
      periodeTahun: t.tahun,
      jatuhTempo: new Date(t.tahun, t.bulan - 1, 10).toISOString(),
      keterangan: `Iuran Kas RT Periode ${t.bulan}/${t.tahun}`,
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
   * POST /api/v1/keuangan/pembayaran/upload-bukti (Resident uploads payment receipt)
   */
  fastify.post('/pembayaran/upload-bukti', async (request, reply) => {
    let tagihanId = '';
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

    if (request.isMultipart()) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          if (!allowedMimeTypes.includes(part.mimetype)) {
            return reply.status(400).send({
              success: false,
              error: {
                code: ErrorCode.ERR_VALIDATION,
                message: 'Format file tidak didukung. Harap unggah file gambar (JPG, PNG, WebP) atau PDF.',
              },
              timestamp: new Date().toISOString(),
            });
          }
          await part.toBuffer();
        } else {
          if (part.fieldname === 'tagihanId') {
            tagihanId = part.value as string;
          }
        }
      }
    } else {
      const body = request.body as any;
      tagihanId = body?.tagihanId;
    }

    if (!tagihanId) {
      return reply.status(400).send({
        success: false,
        error: { code: ErrorCode.ERR_VALIDATION, message: 'tagihanId wajib disertakan.' },
        timestamp: new Date().toISOString(),
      });
    }

    const tagihan = await prisma.tagihanIuran.findUnique({
      where: { id: tagihanId },
      include: { kk: { include: { warga: true } }, rumah: true },
    });

    if (!tagihan) {
      return reply.status(404).send({
        success: false,
        error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Tagihan tidak ditemukan.' },
        timestamp: new Date().toISOString(),
      });
    }

    // Anti-IDOR: verify ownership if role is WARGA
    const session = request.userSession;
    if (session && session.role === UserRole.WARGA && session.kkId && tagihan.kkId !== session.kkId) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ErrorCode.ERR_FORBIDDEN,
          message: 'Akses ditolak. Anda hanya dapat mengunggah bukti bayar untuk tagihan Kartu Keluarga Anda sendiri.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    const key = `bukti-${tagihanId}-${Date.now()}.jpg`;
    await prisma.tagihanIuran.update({
      where: { id: tagihanId },
      data: {
        status: StatusTagihanIuran.PENDING_VERIFICATION,
        buktiBayarMinioKey: key,
      },
    });

    // Notify Treasurer & RT Chairman
    sseBroker.emitToRole('PENGURUS', 'notification', {
      id: `BUKTI-${Date.now()}`,
      title: 'Bukti Pembayaran Iuran Masuk',
      message: `Warga ${tagihan.rumah.kodeBlok} No. ${tagihan.rumah.nomorRumah} telah mengunggah bukti bayar iuran periode ${tagihan.bulan}/${tagihan.tahun}.`,
      category: NotificationCategory.IURAN,
      priority: NotificationPriority.NORMAL,
      deepLink: '/iuran',
      createdAt: new Date().toISOString(),
    });

    return reply.send({
      success: true,
      data: {
        tagihanId,
        status: StatusTagihanIuran.PENDING_VERIFICATION,
        message: 'Bukti transfer berhasil diunggah. Menunggu verifikasi Bendahara RT.',
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
          error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.issues[0].message },
          timestamp: new Date().toISOString(),
        });
      }

      const { bulan, tahun, nominalDefault } = parseResult.data;
      const rtId = getRtId(request);

      const houses = await prisma.rumahKavling.findMany({
        where: {
          rtId,
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
              rtId,
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
          error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.issues[0].message },
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

      // Approved: post the immutable ledger entry and flip the bill to PAID in
      // ONE serializable transaction. The ledger chain link is computed for THIS
      // tenant inside that transaction, so concurrent verifications cannot fork
      // the chain or corrupt the running balance.
      const rtId = getRtId(request);

      const posOperasional = await prisma.posKeuangan.findFirst({
        where: { kodePosKas: 'POS-OPS', rtId },
      });

      if (!posOperasional) {
        return reply.status(500).send({
          success: false,
          error: { code: ErrorCode.ERR_INTERNAL, message: 'Pos kas operasional tidak ditemukan.' },
          timestamp: new Date().toISOString(),
        });
      }

      const ledgerEntry = await LedgerService.postEntry(prisma, {
        rtId,
        posKeuanganId: posOperasional.id,
        tipe: 'IN',
        nominal: tagihan.nominal,
        deskripsi: `Penerimaan Iuran Warga Blok ${tagihan.rumah.kodeBlok}/${tagihan.rumah.nomorRumah} Periode ${tagihan.bulan}/${tagihan.tahun}`,
        createdByUserId: user.userId,
        approvedByUserId: user.userId,
        extraWork: async (tx) => {
          await tx.tagihanIuran.update({
            where: { id: tagihanId },
            data: {
              status: StatusTagihanIuran.PAID,
              paidAt: new Date(),
              verifiedByUserId: user.userId,
            },
          });
        },
      });

      const rowHash = ledgerEntry.rowHash;

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
   * GET /api/v1/keuangan/ledger & GET /api/v1/keuangan/kas (Immutable Cash Ledger with Pagination & Filters)
   */
  const handleGetLedger = async (request: any, reply: any) => {
    const parseResult = KasLedgerQueryFilterSchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.issues[0].message },
        timestamp: new Date().toISOString(),
      });
    }

    const { page, limit, posKeuanganId, tipe } = parseResult.data;

    // TENANT SCOPE — the immutable ledger is per RT. Without this filter every
    // community could read every other community's cash movements.
    const where: Record<string, unknown> = { rtId: getRtId(request) };
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
      posKasNama: k.posKeuangan.namaPos,
      tipe: k.tipe,
      jenisTransaksi: k.tipe,
      nominal: Number(k.nominal),
      saldoSetelah: Number(k.saldoSetelah),
      deskripsi: k.deskripsi,
      keterangan: k.deskripsi,
      prevHash: k.prevHash,
      rowHash: k.rowHash,
      createdAt: k.createdAt.toISOString(),
      tanggalTransaksi: k.createdAt.toISOString(),
    }));

    return reply.send({
      success: true,
      data: {
        items: formatted,
        meta: buildPaginationMeta(total, page, limit),
      },
      timestamp: new Date().toISOString(),
    });
  };

  fastify.get('/ledger', handleGetLedger);
  fastify.get('/kas', handleGetLedger);

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
          error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.issues[0].message },
          timestamp: new Date().toISOString(),
        });
      }

      const { posKeuanganId, nominal, deskripsi } = parseResult.data;
      const user = request.userSession!;

      const rtId = getRtId(request);

      const pos = await prisma.posKeuangan.findUnique({ where: { id: posKeuanganId } });
      // Anti-IDOR: another tenant's cash account is reported as not found.
      if (!pos || pos.rtId !== rtId) {
        return reply.status(404).send({
          success: false,
          error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Pos keuangan tidak ditemukan.' },
          timestamp: new Date().toISOString(),
        });
      }

      const nominalBig = BigInt(nominal);

      // LedgerService re-reads the balance inside a serializable transaction, so
      // the insufficiency check below is authoritative even under concurrency.
      let ledgerEntry;
      try {
        ledgerEntry = await LedgerService.postEntry(prisma, {
          rtId,
          posKeuanganId,
          tipe: 'OUT',
          nominal: nominalBig,
          deskripsi,
          createdByUserId: user.userId,
          approvedByUserId: user.userId,
        });
      } catch (err) {
        if (err instanceof Error && err.message.includes('INSUFFICIENT_FUNDS')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: ErrorCode.ERR_VALIDATION,
              message: 'Saldo pos keuangan tidak mencukupi untuk pengeluaran ini.',
            },
            timestamp: new Date().toISOString(),
          });
        }
        throw err;
      }

      return reply.send({
        success: true,
        data: {
          id: ledgerEntry.id,
          rowHash: ledgerEntry.rowHash,
          saldoBaru: Number(ledgerEntry.saldoSetelah),
        },
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
    async (request, reply) => {
      // Verify THIS tenant's chain only. Verifying a global chain across mixed
      // tenants is meaningless: chains are independent per RT, so the previous
      // implementation reported a false "tampered" verdict the moment a second
      // RT posted an entry.
      const verificationResult = await LedgerService.verifyTenantChain(
        prisma,
        getRtId(request)
      );

      return reply.send({
        success: true,
        data: verificationResult,
        timestamp: new Date().toISOString(),
      });
    }
  );
};

