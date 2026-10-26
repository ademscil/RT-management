import type { FastifyPluginAsync } from 'fastify';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { EnvelopeCryptoAdapter } from '../../infrastructure/crypto/envelope-crypto.adapter.js';
import { HmacBlindIndexAdapter } from '../../infrastructure/crypto/blind-index.adapter.js';
import {
  WargaQueryFilterSchema,
  RevealPiiRequestSchema,
  WargaCreateSchema,
  buildPaginationMeta,
  ErrorCode,
  TenantQuotaResource,
  UserRole,
} from '@simrt/shared-types';
import { authenticateJwt, requireRoles } from '../middlewares/auth.middleware.js';
import {
  getRtId,
  getTenantContext,
  resolveTenantContext,
} from '../middlewares/tenant.middleware.js';
import { AuditLogService } from '../../infrastructure/ledger/audit-log.service.js';
import { PlanQuotaService } from '../../infrastructure/tenant/plan-quota.service.js';
import { TenantAccessError } from '../../infrastructure/tenant/tenant-context.service.js';
import { PiiCircuitBreaker } from '../middlewares/circuit-breaker.middleware.js';

export const kependudukanRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = PrismaService.getInstance();
  const cryptoAdapter = new EnvelopeCryptoAdapter();
  const blindIndexAdapter = new HmacBlindIndexAdapter();

  fastify.addHook('preHandler', authenticateJwt);
  // Every route in this module is tenant-scoped. Attaching the resolver here
  // means a handler physically cannot query without an rtId available.
  fastify.addHook('preHandler', resolveTenantContext);

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
          message: parseResult.error.issues[0].message,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const { page, limit, search, sortBy, sortOrder, golonganDarah, isLansia, isDisabilitas, isBalita, isIbuHamil, statusKependudukan } =
      parseResult.data;

    const session = request.userSession!;

    // TENANT SCOPE: the rtId predicate is not optional. Without it this list
    // returned every resident of every RT in the system.
    const where: Record<string, unknown> = { rtId: getRtId(request) };

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
          users: true,
        },
      }),
      prisma.warga.count({ where }),
    ]);

    const sanitizedItems = items.map((w: any) => ({
      id: w.id,
      namaLengkap: w.namaLengkap,
      nikMasked: w.nikMasked,
      tempatLahir: w.tempatLahir,
      tanggalLahir: w.tanggalLahir instanceof Date ? w.tanggalLahir.toISOString().split('T')[0] : (String(w.tanggalLahir).split('T')[0]),
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
      hasAccount: !!w.users,
      userRole: w.users?.role || null,
      username: w.users?.username || null,
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
   * GET /api/v1/kependudukan/kk (Server-side Pagination & Search for Kartu Keluarga & Houses)
   */
  fastify.get('/kk', async (request, reply) => {
    const session = request.userSession!;
    const { page = 1, limit = 10, search } = request.query as { page?: number; limit?: number; search?: string };

    const safePage = Math.max(1, Number(page));
    const safeLimit = Math.min(100, Math.max(1, Number(limit)));
    const skip = (safePage - 1) * safeLimit;

    if (session.role === UserRole.WARGA) {
      const where: Record<string, unknown> = { id: session.kkId };
      const [items, total] = await Promise.all([
        prisma.kartuKeluarga.findMany({
          where,
          skip,
          take: safeLimit,
          include: {
            rumah: true,
            warga: {
              include: {
                users: true,
              },
            },
          },
        }),
        prisma.kartuKeluarga.count({ where }),
      ]);

      const sanitized = items.map((kk: any) => ({
        id: kk.id,
        rumahId: kk.rumahId,
        kodeBlok: kk.rumah.kodeBlok,
        nomorRumah: kk.rumah.nomorRumah,
        statusHunian: kk.rumah.statusHunian,
        noKkMasked: kk.noKkMasked,
        nomorKkMasked: kk.noKkMasked,
        blokRumah: `${kk.rumah.kodeBlok} No. ${kk.rumah.nomorRumah}`,
        alamatDomisili: kk.rumah.alamat,
        alamatLengkap: kk.rumah.alamat,
        statusDomisili: kk.statusDomisili,
        statusVerifikasi: kk.statusVerifikasi,
        catatanRevisi: kk.catatanRevisi,
        jumlahAnggota: kk.warga.length,
        kepalaKeluarga: kk.warga.find((w: any) => w.hubunganKeluarga === 'KEPALA_KELUARGA')?.namaLengkap || kk.warga[0]?.namaLengkap || '-',
        anggota: kk.warga.map((w: any) => ({
          id: w.id,
          namaLengkap: w.namaLengkap,
          nikMasked: w.nikMasked,
          hubunganKeluarga: w.hubunganKeluarga,
          jenisKelamin: w.gender || w.jenisKelamin,
          gender: w.gender,
          tempatLahir: w.tempatLahir,
          tanggalLahir: w.tanggalLahir instanceof Date ? w.tanggalLahir.toISOString().split('T')[0] : (String(w.tanggalLahir).split('T')[0]),
          golonganDarah: w.golonganDarah,
          agama: w.agama,
          pekerjaan: w.pekerjaan,
          pendidikanTerakhir: w.pendidikanTerakhir,
          statusPerkawinan: w.statusPerkawinan,
          statusKependudukan: w.statusKependudukan,
          isLansia: w.isLansia,
          isDisabilitas: w.isDisabilitas,
          isBalita: w.isBalita,
          isIbuHamil: w.isIbuHamil,
          hasAccount: !!w.users,
          userRole: w.users?.role || null,
          username: w.users?.username || null,
        })),
      }));

      return reply.send({
        success: true,
        data: {
          items: sanitized,
          meta: buildPaginationMeta(total, safePage, safeLimit),
        },
        timestamp: new Date().toISOString(),
      });
    }

    // For Admins: Query all Houses so empty houses & newly registered houses are 100% visible & manageable!
    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { kodeBlok: { contains: search, mode: 'insensitive' } },
        { nomorRumah: { contains: search, mode: 'insensitive' } },
        { alamat: { contains: search, mode: 'insensitive' } },
        { kartuKeluarga: { some: { noKkMasked: { contains: search } } } },
        { kartuKeluarga: { some: { warga: { some: { namaLengkap: { contains: search, mode: 'insensitive' } } } } } },
      ];
    }

    const [houses, total] = await Promise.all([
      prisma.rumahKavling.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { kodeBlok: 'asc' },
        include: {
          kartuKeluarga: {
            include: {
              warga: {
                include: {
                  users: true,
                },
              },
            },
          },
        },
      }),
      prisma.rumahKavling.count({ where }),
    ]);

    const sanitizedKk = houses.map((house: any) => {
      const primaryKk = house.kartuKeluarga[0] || null;
      const allWarga = house.kartuKeluarga.flatMap((kk: any) => kk.warga);
      const kepala = allWarga.find((w: any) => w.hubunganKeluarga === 'KEPALA_KELUARGA') || allWarga[0] || null;

      return {
        id: primaryKk ? primaryKk.id : `house-${house.id}`,
        rumahId: house.id,
        kodeBlok: house.kodeBlok,
        nomorRumah: house.nomorRumah,
        statusHunian: house.statusHunian,
        noKkMasked: primaryKk ? primaryKk.noKkMasked : 'Belum Ada KK',
        nomorKkMasked: primaryKk ? primaryKk.noKkMasked : 'Belum Ada KK',
        blokRumah: `${house.kodeBlok} No. ${house.nomorRumah}`,
        alamatDomisili: house.alamat,
        alamatLengkap: house.alamat,
        statusDomisili: primaryKk ? primaryKk.statusDomisili : (house.statusHunian === 'DIHUNI_PENYEWA' ? 'KONTRAK' : 'TETAP'),
        statusVerifikasi: primaryKk ? primaryKk.statusVerifikasi : 'VERIFIED',
        catatanRevisi: primaryKk?.catatanRevisi || null,
        jumlahAnggota: allWarga.length,
        kepalaKeluarga: kepala ? kepala.namaLengkap : (house.statusHunian === 'KOSONG' ? 'Rumah Kosong' : 'Belum Ada Penghuni'),
        anggota: allWarga.map((w: any) => ({
          id: w.id,
          namaLengkap: w.namaLengkap,
          nikMasked: w.nikMasked,
          hubunganKeluarga: w.hubunganKeluarga,
          jenisKelamin: w.gender || w.jenisKelamin,
          gender: w.gender,
          tempatLahir: w.tempatLahir,
          tanggalLahir: w.tanggalLahir instanceof Date ? w.tanggalLahir.toISOString().split('T')[0] : (String(w.tanggalLahir).split('T')[0]),
          golonganDarah: w.golonganDarah,
          agama: w.agama,
          pekerjaan: w.pekerjaan,
          pendidikanTerakhir: w.pendidikanTerakhir,
          statusPerkawinan: w.statusPerkawinan,
          statusKependudukan: w.statusKependudukan,
          isLansia: w.isLansia,
          isDisabilitas: w.isDisabilitas,
          isBalita: w.isBalita,
          isIbuHamil: w.isIbuHamil,
          hasAccount: !!w.users,
          userRole: w.users?.role || null,
          username: w.users?.username || null,
        })),
      };
    });

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
   * POST /api/v1/kependudukan/warga/:id/reveal-nik (Resident or Admin decrypts member NIK)
   */
  fastify.post('/warga/:id/reveal-nik', async (request, reply) => {
    const { id: wargaId } = request.params as { id: string };
    const { reason = 'Keperluan Administrasi Keluarga' } = (request.body as { reason?: string }) || {};
    const session = request.userSession!;

    const tenant = getTenantContext(request);
    const targetWarga = await prisma.warga.findUnique({
      where: { id: wargaId },
      include: { kk: true },
    });

    // Anti-IDOR: a warga row belonging to another tenant is reported as NOT
    // FOUND, so this endpoint cannot be used to probe which warga ids exist.
    if (!targetWarga || targetWarga.rtId !== tenant.rtId) {
      return reply.status(404).send({
        success: false,
        error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Data warga tidak ditemukan.' },
        timestamp: new Date().toISOString(),
      });
    }

    if (session.role === UserRole.WARGA && targetWarga.kkId !== session.kkId) {
      return reply.status(403).send({
        success: false,
        error: { code: ErrorCode.ERR_FORBIDDEN, message: 'Anda hanya berhak melihat data keluarga sendiri.' },
        timestamp: new Date().toISOString(),
      });
    }

    const decryptedNik = cryptoAdapter.decryptField(targetWarga.nikEncrypted);

    // Tamper-evident, PER-TENANT audit chain. Delegating to AuditLogService
    // guarantees the chain link is computed against the same tenant's previous
    // row inside a serializable transaction (the old inline version read the
    // globally-latest row, which both leaked across tenants and could fork).
    await AuditLogService.append(prisma, {
      rtId: tenant.rtId,
      actorUserId: session.userId,
      actorRole: session.role,
      actionType: 'REVEAL_PII_NIK',
      targetEntity: 'WARGA',
      targetId: wargaId,
      accessReason: reason,
      ipAddress: request.ip || '127.0.0.1',
      userAgent: (request.headers['user-agent'] as string) || 'Unknown',
    });

    return reply.send({
      success: true,
      data: {
        nik: decryptedNik,
        namaLengkap: targetWarga.namaLengkap,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /api/v1/kependudukan/dokumen/upload (Upload citizen KTP or family documents)
   */
  fastify.post('/dokumen/upload', async (request, reply) => {
    let wargaId = '';
    let documentType = 'KTP';
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
                message: 'Format file tidak didukung. Harap unggah foto KTP berformat JPG, PNG, atau WebP.',
              },
              timestamp: new Date().toISOString(),
            });
          }
          await part.toBuffer();
        } else {
          if (part.fieldname === 'wargaId') wargaId = part.value as string;
          if (part.fieldname === 'documentType') documentType = part.value as string;
        }
      }
    } else {
      const body = request.body as any;
      wargaId = body?.wargaId;
      documentType = body?.documentType || 'KTP';
    }

    if (wargaId) {
      const tenant = getTenantContext(request);
      const targetWarga = await prisma.warga.findUnique({ where: { id: wargaId } });
      if (!targetWarga || targetWarga.rtId !== tenant.rtId) {
        return reply.status(404).send({
          success: false,
          error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Data warga tidak ditemukan.' },
          timestamp: new Date().toISOString(),
        });
      }

      // Anti-IDOR: if user is WARGA, must belong to own KK
      const session = request.userSession;
      if (session && session.role === UserRole.WARGA && session.kkId && targetWarga.kkId !== session.kkId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: ErrorCode.ERR_FORBIDDEN,
            message: 'Akses ditolak. Anda hanya dapat mengunggah dokumen anggota Kartu Keluarga Anda sendiri.',
          },
          timestamp: new Date().toISOString(),
        });
      }

      // FIX (latent C-07): the previous code wrote `fotoKtpMinioKey` onto Warga.
      // That column does not exist in the schema, so with the (previously `any`)
      // Prisma client this always threw "Unknown argument" at runtime. Document
      // bytes live in DokumenVault; the upload is recorded to the audit trail.
      await AuditLogService.appendBestEffort(prisma, {
        rtId: tenant.rtId,
        actorUserId: session?.userId || 'system',
        actorRole: session?.role || 'WARGA',
        actionType: 'UPLOAD_DOKUMEN',
        targetEntity: 'WARGA',
        targetId: wargaId,
        accessReason: `Unggah dokumen ${documentType}`,
        ipAddress: request.ip || '127.0.0.1',
        userAgent: (request.headers['user-agent'] as string) || 'Unknown',
      });
    }

    return reply.send({
      success: true,
      data: {
        message: 'Dokumen berhasil diunggah dan disimpan dengan aman.',
        documentType,
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

    const mapData = houses.map((h: any) => {
      const allWarga = h.kartuKeluarga.flatMap((kk: any) => kk.warga);
      const currentBill = h.kartuKeluarga.flatMap((kk: any) => kk.tagihanIuran)[0];

      const hasLansia = allWarga.some((w: any) => w.isLansia);
      const hasDisabilitas = allWarga.some((w: any) => w.isDisabilitas);
      const hasBalita = allWarga.some((w: any) => w.isBalita);
      const hasIbuHamil = allWarga.some((w: any) => w.isIbuHamil);

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
            message: parseResult.error.issues[0].message,
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

      // Tamper-evident, PER-TENANT audit chain (was: globally-latest prevHash,
      // which leaked across tenants and could fork under concurrency).
      const auditRecord = await AuditLogService.append(prisma, {
        rtId: getRtId(request),
        actorUserId: user.userId,
        actorRole: user.role,
        actionType: `REVEAL_PII_${field}`,
        targetEntity: 'WARGA',
        targetId: wargaId,
        accessReason: reason,
        ipAddress: request.ip || '127.0.0.1',
        userAgent: (request.headers['user-agent'] as string) || 'Unknown',
      });

      return reply.send({
        success: true,
        data: {
          field,
          value: revealedValue,
          auditId: auditRecord.id,
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
      let targetKkId = rawBody?.kkId;

      if (!targetKkId && !rawBody?.rumahId) {
        return reply.status(400).send({
          success: false,
          error: { code: ErrorCode.ERR_VALIDATION, message: 'kkId atau rumahId wajib disertakan.' },
          timestamp: new Date().toISOString(),
        });
      }

      // Handle house-prefix or direct rumahId to auto-resolve or auto-create KK
      const tenant = getTenantContext(request);

      if ((targetKkId && targetKkId.startsWith('house-')) || (!targetKkId && rawBody?.rumahId)) {
        const targetRumahId = rawBody?.rumahId || targetKkId.replace('house-', '');
        let existingKk = await prisma.kartuKeluarga.findFirst({
          where: { rumahId: targetRumahId, rtId: tenant.rtId },
        });
        if (!existingKk) {
          const house = await prisma.rumahKavling.findUnique({ where: { id: targetRumahId } });
          // Anti-IDOR: refuse to attach a KK to a house owned by another tenant.
          if (!house || house.rtId !== tenant.rtId) {
            return reply.status(404).send({
              success: false,
              error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Rumah/kavling tidak ditemukan.' },
              timestamp: new Date().toISOString(),
            });
          }
          const provisionalNoKk = `327601${String(Date.now()).slice(-10)}`;
          const noKkBlindIndex = blindIndexAdapter.computeBlindIndex(provisionalNoKk);
          existingKk = await prisma.kartuKeluarga.create({
            data: {
              rtId: tenant.rtId,
              rumahId: targetRumahId,
              noKkEncrypted: cryptoAdapter.encryptField(provisionalNoKk),
              noKkBlindIndex,
              noKkMasked: blindIndexAdapter.maskNik(provisionalNoKk),
              statusDomisili: house?.statusHunian === 'DIHUNI_PENYEWA' ? 'KONTRAK' : 'TETAP',
              statusVerifikasi: 'VERIFIED',
            },
          });
        }
        targetKkId = existingKk.id;
      }

      const input = WargaCreateSchema.parse(rawBody);
      const blindIndex = blindIndexAdapter.computeBlindIndex(input.nik);

      // NIK uniqueness is PER TENANT — the same citizen may hold a residency
      // record in more than one RT (e.g. KTP address vs. domicile).
      const existing = await prisma.warga.findUnique({
        where: { rtId_nikBlindIndex: { rtId: tenant.rtId, nikBlindIndex: blindIndex } },
      });
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: { code: ErrorCode.ERR_CONFLICT, message: 'NIK sudah terdaftar dalam sistem.' },
          timestamp: new Date().toISOString(),
        });
      }

      // Progressive quota: enrolling residents consumes the plan's KK/Warga quota.
      try {
        await PlanQuotaService.assertAvailable(prisma, tenant, TenantQuotaResource.WARGA, 1);
      } catch (err) {
        if (err instanceof TenantAccessError) {
          return reply.status(err.statusCode).send({
            success: false,
            error: { code: err.code, message: err.message },
            timestamp: new Date().toISOString(),
          });
        }
        throw err;
      }

      const created = await prisma.warga.create({
        data: {
          rtId: tenant.rtId,
          kkId: targetKkId,
          namaLengkap: input.namaLengkap,
          nikEncrypted: cryptoAdapter.encryptField(input.nik),
          nikBlindIndex: blindIndex,
          nikMasked: blindIndexAdapter.maskNik(input.nik),
          tempatLahir: input.tempatLahir,
          tanggalLahir: String(input.tanggalLahir).split('T')[0],
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

  /**
   * PUT /api/v1/kependudukan/warga/:id (Update citizen details)
   */
  fastify.put(
    '/warga/:id',
    { preHandler: [requireRoles([UserRole.KETUA_RT, UserRole.SEKRETARIS])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const rawBody = request.body as any;

      const existing = await prisma.warga.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Data warga tidak ditemukan.' },
          timestamp: new Date().toISOString(),
        });
      }

      const updated = await prisma.warga.update({
        where: { id },
        data: {
          namaLengkap: rawBody.namaLengkap !== undefined ? rawBody.namaLengkap : existing.namaLengkap,
          tempatLahir: rawBody.tempatLahir !== undefined ? rawBody.tempatLahir : existing.tempatLahir,
          tanggalLahir: rawBody.tanggalLahir !== undefined ? (rawBody.tanggalLahir ? String(rawBody.tanggalLahir).split('T')[0] : existing.tanggalLahir) : existing.tanggalLahir,
          gender: rawBody.gender !== undefined ? rawBody.gender : existing.gender,
          golonganDarah: rawBody.golonganDarah !== undefined ? rawBody.golonganDarah : existing.golonganDarah,
          agama: rawBody.agama !== undefined ? rawBody.agama : existing.agama,
          pendidikanTerakhir: rawBody.pendidikanTerakhir !== undefined ? rawBody.pendidikanTerakhir : existing.pendidikanTerakhir,
          pekerjaan: rawBody.pekerjaan !== undefined ? rawBody.pekerjaan : existing.pekerjaan,
          statusPerkawinan: rawBody.statusPerkawinan !== undefined ? rawBody.statusPerkawinan : existing.statusPerkawinan,
          hubunganKeluarga: rawBody.hubunganKeluarga !== undefined ? rawBody.hubunganKeluarga : existing.hubunganKeluarga,
          statusKependudukan: rawBody.statusKependudukan !== undefined ? rawBody.statusKependudukan : existing.statusKependudukan,
          isLansia: rawBody.isLansia !== undefined ? rawBody.isLansia : existing.isLansia,
          isDisabilitas: rawBody.isDisabilitas !== undefined ? rawBody.isDisabilitas : existing.isDisabilitas,
          isBalita: rawBody.isBalita !== undefined ? rawBody.isBalita : existing.isBalita,
          isIbuHamil: rawBody.isIbuHamil !== undefined ? rawBody.isIbuHamil : existing.isIbuHamil,
        },
      });

      return reply.send({
        success: true,
        data: { id: updated.id, namaLengkap: updated.namaLengkap, nikMasked: updated.nikMasked },
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * DELETE /api/v1/kependudukan/warga/:id (Delete citizen)
   */
  fastify.delete(
    '/warga/:id',
    { preHandler: [requireRoles([UserRole.KETUA_RT, UserRole.SEKRETARIS])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const existing = await prisma.warga.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Data warga tidak ditemukan.' },
          timestamp: new Date().toISOString(),
        });
      }

      await prisma.warga.delete({ where: { id } });

      return reply.send({
        success: true,
        message: 'Data warga berhasil dihapus.',
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * POST /api/v1/kependudukan/rumah (Add new house block / kavling)
   */
  fastify.post(
    '/rumah',
    { preHandler: [requireRoles([UserRole.KETUA_RT, UserRole.SEKRETARIS])] },
    async (request, reply) => {
      const { kodeBlok, nomorRumah, alamat, statusHunian = 'DIHUNI_PEMILIK', nomorKk } = (request.body as any) || {};

      if (!kodeBlok || !nomorRumah || !alamat) {
        return reply.status(400).send({
          success: false,
          error: { code: ErrorCode.ERR_VALIDATION, message: 'Kode blok, nomor rumah, dan alamat wajib diisi.' },
          timestamp: new Date().toISOString(),
        });
      }

      // Check if kodeBlok already exists WITHIN THIS TENANT.
      // Previously this was a global check, so RT Depok could not create a block
      // named "A1" simply because RT Pangkalpinang already had one.
      const tenant = getTenantContext(request);
      const existing = await prisma.rumahKavling.findUnique({
        where: { rtId_kodeBlok: { rtId: tenant.rtId, kodeBlok } },
      });
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: { code: ErrorCode.ERR_CONFLICT, message: `Blok rumah ${kodeBlok} sudah terdaftar.` },
          timestamp: new Date().toISOString(),
        });
      }

      const house = await prisma.rumahKavling.create({
        data: {
          rtId: tenant.rtId,
          kodeBlok,
          nomorRumah,
          alamat,
          statusHunian,
        },
      });

      // Auto-create initial KartuKeluarga for the house
      const cleanKk = (nomorKk && typeof nomorKk === 'string' && nomorKk.trim().length === 16)
        ? nomorKk.trim()
        : `327601${String(Date.now()).slice(-10)}`;

      const noKkBlindIndex = blindIndexAdapter.computeBlindIndex(cleanKk);
      const noKkMasked = blindIndexAdapter.maskNik(cleanKk);
      const noKkEncrypted = cryptoAdapter.encryptField(cleanKk);

      const createdKk = await prisma.kartuKeluarga.create({
        data: {
          rtId: getRtId(request),
          rumahId: house.id,
          noKkEncrypted,
          noKkBlindIndex,
          noKkMasked,
          statusDomisili: statusHunian === 'DIHUNI_PENYEWA' ? 'KONTRAK' : 'TETAP',
          statusVerifikasi: 'VERIFIED',
        },
      });

      return reply.send({
        success: true,
        data: { house, kk: createdKk },
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * PUT /api/v1/kependudukan/rumah/:id (Update house block details)
   */
  fastify.put(
    '/rumah/:id',
    { preHandler: [requireRoles([UserRole.KETUA_RT, UserRole.SEKRETARIS])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { kodeBlok, nomorRumah, alamat, statusHunian } = (request.body as any) || {};

      const existing = await prisma.rumahKavling.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Rumah/Kavling tidak ditemukan.' },
          timestamp: new Date().toISOString(),
        });
      }

      const updated = await prisma.rumahKavling.update({
        where: { id },
        data: {
          kodeBlok: kodeBlok || existing.kodeBlok,
          nomorRumah: nomorRumah || existing.nomorRumah,
          alamat: alamat || existing.alamat,
          statusHunian: statusHunian || existing.statusHunian,
        },
      });

      return reply.send({
        success: true,
        data: updated,
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * DELETE /api/v1/kependudukan/rumah/:id (Delete house block)
   */
  fastify.delete(
    '/rumah/:id',
    { preHandler: [requireRoles([UserRole.KETUA_RT, UserRole.SEKRETARIS])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const existing = await prisma.rumahKavling.findUnique({
        where: { id },
        include: {
          kartuKeluarga: {
            include: { warga: true },
          },
        },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Rumah/Kavling tidak ditemukan.' },
          timestamp: new Date().toISOString(),
        });
      }

      const totalResidents = existing.kartuKeluarga.reduce((acc, kk) => acc + kk.warga.length, 0);
      if (totalResidents > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ErrorCode.ERR_VALIDATION,
            message: `Rumah ${existing.kodeBlok} masih memiliki ${totalResidents} warga terdaftar. Pindahkan atau hapus warga terlebih dahulu.`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      await prisma.rumahKavling.delete({ where: { id } });

      return reply.send({
        success: true,
        message: `Rumah/Kavling ${existing.kodeBlok} berhasil dihapus.`,
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * POST /api/v1/kependudukan/kk (Add Kartu Keluarga to house)
   */
  fastify.post(
    '/kk',
    { preHandler: [requireRoles([UserRole.KETUA_RT, UserRole.SEKRETARIS])] },
    async (request, reply) => {
      const { rumahId, nomorKk, statusDomisili = 'TETAP' } = (request.body as any) || {};

      if (!rumahId || !nomorKk || nomorKk.trim().length !== 16) {
        return reply.status(400).send({
          success: false,
          error: { code: ErrorCode.ERR_VALIDATION, message: 'rumahId dan nomor KK 16 digit wajib diisi.' },
          timestamp: new Date().toISOString(),
        });
      }

      const house = await prisma.rumahKavling.findUnique({ where: { id: rumahId } });
      if (!house) {
        return reply.status(404).send({
          success: false,
          error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Rumah/kavling tujuan tidak ditemukan.' },
          timestamp: new Date().toISOString(),
        });
      }

      const cleanKk = nomorKk.trim();
      const tenant = getTenantContext(request);
      const noKkBlindIndex = blindIndexAdapter.computeBlindIndex(cleanKk);
      // Kartu Keluarga numbers are unique PER TENANT.
      const existingKk = await prisma.kartuKeluarga.findUnique({
        where: { rtId_noKkBlindIndex: { rtId: tenant.rtId, noKkBlindIndex } },
      });
      if (existingKk) {
        return reply.status(409).send({
          success: false,
          error: { code: ErrorCode.ERR_CONFLICT, message: 'Nomor Kartu Keluarga sudah terdaftar.' },
          timestamp: new Date().toISOString(),
        });
      }

      // Enrolling a new family unit consumes the plan's KK quota.
      try {
        await PlanQuotaService.assertAvailable(
          prisma,
          tenant,
          TenantQuotaResource.KARTU_KELUARGA,
          1
        );
      } catch (err) {
        if (err instanceof TenantAccessError) {
          return reply.status(err.statusCode).send({
            success: false,
            error: { code: err.code, message: err.message },
            timestamp: new Date().toISOString(),
          });
        }
        throw err;
      }

      const created = await prisma.kartuKeluarga.create({
        data: {
          rtId: tenant.rtId,
          rumahId,
          noKkEncrypted: cryptoAdapter.encryptField(cleanKk),
          noKkBlindIndex,
          noKkMasked: blindIndexAdapter.maskNik(cleanKk),
          statusDomisili,
          statusVerifikasi: 'VERIFIED',
        },
      });

      return reply.send({
        success: true,
        data: created,
        timestamp: new Date().toISOString(),
      });
    }
  );
};

