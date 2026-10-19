import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { Ed25519SignerAdapter } from '../../infrastructure/crypto/ed25519-signer.adapter.js';
import { EnvelopeCryptoAdapter } from '../../infrastructure/crypto/envelope-crypto.adapter.js';
import { PdfGeneratorService } from '../../infrastructure/pdf/pdf-generator.service.js';
import { MinioStorageAdapter } from '../../infrastructure/storage/minio-storage.adapter.js';
import type { SSEBrokerService } from '../../infrastructure/realtime/sse-broker.service.js';
import {
  AjukanSuratSchema,
  VerifikasiSekretarisSchema,
  TandaTanganKetuaRTSchema,
  SuratQueryFilterSchema,
  buildPaginationMeta,
  ErrorCode,
  UserRole,
  StatusPengajuanSurat,
  NotificationCategory,
  NotificationPriority,
} from '@simrt/shared-types';
import { authenticateJwt, requireRoles } from '../middlewares/auth.middleware.js';

export const suratRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = PrismaService.getInstance();
  const signerAdapter = new Ed25519SignerAdapter();
  const cryptoAdapter = new EnvelopeCryptoAdapter();
  const pdfService = new PdfGeneratorService();
  const storageAdapter = new MinioStorageAdapter();
  const sseBroker = (fastify as any).sseBroker as SSEBrokerService;

  /**
   * GET /api/v1/surat/templates
   */
  fastify.get('/templates', { preHandler: [authenticateJwt] }, async (_request, reply) => {
    const templates = await prisma.jenisSuratTemplate.findMany({
      orderBy: { namaSurat: 'asc' },
    });

    return reply.send({
      success: true,
      data: templates.map((t) => ({
        id: t.id,
        kodeSurat: t.kodeSurat,
        namaSurat: t.namaSurat,
        formatNomor: t.formatNomor,
        syaratDokumen: JSON.parse(t.syaratDokumen || '[]'),
      })),
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /api/v1/surat (Server-side Pagination, Status Filter & Search)
   */
  fastify.get('/', { preHandler: [authenticateJwt] }, async (request, reply) => {
    const parseResult = SuratQueryFilterSchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.errors[0].message },
        timestamp: new Date().toISOString(),
      });
    }

    const { page, limit, search, status, sortBy, sortOrder } = parseResult.data;
    const session = request.userSession!;

    const where: Record<string, unknown> = {};

    // Resident only sees own family letters
    if (session.role === UserRole.WARGA) {
      where.kkId = session.kkId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { nomorTiket: { contains: search, mode: 'insensitive' } },
        { nomorSuratResmi: { contains: search, mode: 'insensitive' } },
        { pemohonWarga: { namaLengkap: { contains: search, mode: 'insensitive' } } },
        { keperluan: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const orderBy: Record<string, string> = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    const [items, total] = await Promise.all([
      prisma.pengajuanSurat.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          pemohonWarga: { include: { kk: { include: { rumah: true } } } },
          jenisSurat: true,
        },
      }),
      prisma.pengajuanSurat.count({ where }),
    ]);

    const formatted = items.map((s) => ({
      id: s.id,
      nomorTiket: s.nomorTiket,
      nomorSuratResmi: s.nomorSuratResmi,
      jenisSuratNama: s.jenisSurat.namaSurat,
      pemohonNama: s.pemohonWarga.namaLengkap,
      pemohonNikMasked: s.pemohonWarga.nikMasked,
      blokRumah: `${s.pemohonWarga.kk.rumah.kodeBlok} No. ${s.pemohonWarga.kk.rumah.nomorRumah}`,
      keperluan: s.keperluan,
      status: s.status,
      catatanRevisi: s.catatanRevisi,
      pdfMinioKey: s.pdfMinioKey,
      verificationHash: s.verificationHash,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
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
   * POST /api/v1/surat/ajukan (Resident submits letter application)
   */
  fastify.post('/ajukan', { preHandler: [authenticateJwt] }, async (request, reply) => {
    const parseResult = AjukanSuratSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.errors[0].message },
        timestamp: new Date().toISOString(),
      });
    }

    const { jenisSuratId, keperluan } = parseResult.data;
    const session = request.userSession!;

    const nomorTiket = `TKT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newSurat = await prisma.pengajuanSurat.create({
      data: {
        nomorTiket,
        pemohonWargaId: session.wargaId,
        kkId: session.kkId,
        jenisSuratId,
        keperluan,
        status: StatusPengajuanSurat.SUBMITTED,
      },
      include: { pemohonWarga: true, jenisSurat: true },
    });

    // Send SSE Real-Time Notification to Sekretaris & Ketua RT
    sseBroker.emitToRole('PENGURUS', 'notification', {
      id: `SURAT-${Date.now()}`,
      title: 'Pengajuan E-Surat Baru',
      message: `${newSurat.pemohonWarga.namaLengkap} mengajukan ${newSurat.jenisSurat.namaSurat} (#${nomorTiket})`,
      category: NotificationCategory.SURAT,
      priority: NotificationPriority.NORMAL,
      deepLink: '/e-surat',
      createdAt: new Date().toISOString(),
    });

    return reply.send({
      success: true,
      data: {
        id: newSurat.id,
        nomorTiket: newSurat.nomorTiket,
        status: newSurat.status,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /api/v1/surat/verifikasi (Secretary reviews & marks verified or rejected)
   */
  fastify.post(
    '/verifikasi',
    { preHandler: [authenticateJwt, requireRoles([UserRole.SEKRETARIS, UserRole.KETUA_RT])] },
    async (request, reply) => {
      const parseResult = VerifikasiSekretarisSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.errors[0].message },
          timestamp: new Date().toISOString(),
        });
      }

      const { suratId, isApproved, catatan } = parseResult.data;
      const user = request.userSession!;

      const surat = await prisma.pengajuanSurat.findUnique({
        where: { id: suratId },
        include: { pemohonWarga: { include: { users: true } }, jenisSurat: true },
      });

      if (!surat) {
        return reply.status(404).send({
          success: false,
          error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Surat tidak ditemukan.' },
          timestamp: new Date().toISOString(),
        });
      }

      const newStatus = isApproved
        ? StatusPengajuanSurat.VERIFIED_SEKRETARIS
        : StatusPengajuanSurat.REJECTED;

      const updated = await prisma.pengajuanSurat.update({
        where: { id: suratId },
        data: {
          status: newStatus,
          catatanRevisi: catatan || null,
          verifiedByUserId: user.userId,
        },
      });

      // Notify resident via SSE
      if (surat.pemohonWarga.users) {
        sseBroker.emitToUser(surat.pemohonWarga.users.id, 'notification', {
          id: `NOTIF-${Date.now()}`,
          title: isApproved ? 'Surat Telah Diverifikasi Sekretaris' : 'Pengajuan Surat Ditolak',
          message: isApproved
            ? `Pengajuan ${surat.jenisSurat.namaSurat} Anda telah lolos verifikasi dan diteruskan ke Ketua RT untuk penandatanganan.`
            : `Pengajuan ${surat.jenisSurat.namaSurat} Anda ditolak. Catatan: ${catatan || '-'}`,
          category: NotificationCategory.SURAT,
          priority: isApproved ? NotificationPriority.NORMAL : NotificationPriority.HIGH,
          deepLink: '/e-surat',
          createdAt: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: { id: updated.id, status: updated.status },
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * POST /api/v1/surat/tanda-tangan (Chairman signs with Ed25519 & generates official PDF)
   */
  fastify.post(
    '/tanda-tangan',
    { preHandler: [authenticateJwt, requireRoles([UserRole.KETUA_RT])] },
    async (request, reply) => {
      const parseResult = TandaTanganKetuaRTSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: ErrorCode.ERR_VALIDATION, message: parseResult.error.errors[0].message },
          timestamp: new Date().toISOString(),
        });
      }

      const { suratId, nomorSuratResmi } = parseResult.data;
      const user = request.userSession!;

      const surat = await prisma.pengajuanSurat.findUnique({
        where: { id: suratId },
        include: {
          pemohonWarga: { include: { kk: { include: { rumah: true } }, users: true } },
          jenisSurat: true,
        },
      });

      if (!surat) {
        return reply.status(404).send({
          success: false,
          error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Surat tidak ditemukan.' },
          timestamp: new Date().toISOString(),
        });
      }

      const rtConfig = await prisma.rukunTetanggaConfig.findFirst();
      if (!rtConfig || !rtConfig.ed25519PrivateKeyEnc) {
        return reply.status(500).send({
          success: false,
          error: { code: ErrorCode.ERR_INTERNAL, message: 'Kunci penandatanganan digital RT belum diinisialisasi.' },
          timestamp: new Date().toISOString(),
        });
      }

      // 1. Decrypt RT Ed25519 Private Key
      const privateKeyPem = cryptoAdapter.decryptField(rtConfig.ed25519PrivateKeyEnc);

      // 2. Prepare payload to sign
      const verificationHash = crypto
        .createHash('sha256')
        .update(`${surat.id}:${nomorSuratResmi}:${surat.pemohonWargaId}:${new Date().toISOString()}`)
        .digest('hex');

      const dataToSign = `SIMRT_OFFICIAL_SURAT:${nomorSuratResmi}:${surat.pemohonWarga.namaLengkap}:${surat.jenisSurat.kodeSurat}:${verificationHash}`;
      const signatureHex = signerAdapter.sign(dataToSign, privateKeyPem);

      // 3. Generate Official PDF
      const verificationUrl = `${process.env.API_URL || 'http://localhost:3001'}/api/v1/surat/verify/${verificationHash}`;
      const tanggalSurat = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      const pdfBuffer = await pdfService.generateSuratPengantarPdf({
        nomorSurat: nomorSuratResmi,
        namaWarga: surat.pemohonWarga.namaLengkap,
        nikMasked: surat.pemohonWarga.nikMasked,
        tempatTanggalLahir: `${surat.pemohonWarga.tempatLahir}, ${surat.pemohonWarga.tanggalLahir}`,
        agama: surat.pemohonWarga.agama,
        pekerjaan: surat.pemohonWarga.pekerjaan,
        alamat: surat.pemohonWarga.kk.rumah.alamat,
        jenisSurat: surat.jenisSurat.namaSurat,
        keperluan: surat.keperluan,
        tanggalSurat,
        namaKetuaRt: 'Bambang Pamungkas, S.T.',
        signatureHex,
        verificationUrl,
      });

      // 4. Save to MinIO
      const pdfMinioKey = `surat-resmi/${verificationHash}.pdf`;
      try {
        await storageAdapter.upload(
          process.env.MINIO_BUCKET_LETTERS || 'surat-arsip',
          pdfMinioKey,
          pdfBuffer,
          'application/pdf'
        );
      } catch (e) {
        console.warn('Storage upload skipped (MinIO offline during mock/dev).');
      }

      // 5. Update Status in Database
      const updated = await prisma.pengajuanSurat.update({
        where: { id: suratId },
        data: {
          nomorSuratResmi,
          status: StatusPengajuanSurat.SIGNED_KETUA_RT,
          signedByUserId: user.userId,
          ed25519SignatureHex: signatureHex,
          verificationHash,
          pdfMinioKey,
        },
      });

      // 6. Real-Time Notification to Resident
      if (surat.pemohonWarga.users) {
        sseBroker.emitToUser(surat.pemohonWarga.users.id, 'notification', {
          id: `NOTIF-${Date.now()}`,
          title: 'Surat Pengantar Selesai Ditandatangani!',
          message: `Surat ${surat.jenisSurat.namaSurat} Anda dengan Nomor ${nomorSuratResmi} telah ditandatangani digital oleh Ketua RT dan siap diunduh.`,
          category: NotificationCategory.SURAT,
          priority: NotificationPriority.HIGH,
          deepLink: `/e-surat/${updated.id}`,
          createdAt: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: {
          id: updated.id,
          nomorSuratResmi: updated.nomorSuratResmi,
          status: updated.status,
          verificationHash,
          signatureHex,
        },
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * GET /api/v1/surat/verify/:hash (Public Verification Endpoint via QR Code on Letter)
   */
  fastify.get('/verify/:hash', async (request, reply) => {
    const { hash: verificationHash } = request.params as { hash: string };

    const surat = await prisma.pengajuanSurat.findFirst({
      where: { verificationHash },
      include: {
        pemohonWarga: true,
        jenisSurat: true,
      },
    });

    if (!surat || !surat.ed25519SignatureHex) {
      return reply.status(404).send({
        success: false,
        error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Surat dengan kode verifikasi ini tidak valid atau tidak terdaftar.' },
        timestamp: new Date().toISOString(),
      });
    }

    const rtConfig = await prisma.rukunTetanggaConfig.findFirst();
    let isSignatureAuthentic = false;

    if (rtConfig && rtConfig.ed25519PublicKey) {
      const dataToSign = `SIMRT_OFFICIAL_SURAT:${surat.nomorSuratResmi}:${surat.pemohonWarga.namaLengkap}:${surat.jenisSurat.kodeSurat}:${surat.verificationHash}`;
      isSignatureAuthentic = signerAdapter.verify(dataToSign, surat.ed25519SignatureHex, rtConfig.ed25519PublicKey);
    }

    return reply.send({
      success: true,
      data: {
        isVerified: true,
        isSignatureAuthentic,
        nomorSuratResmi: surat.nomorSuratResmi,
        jenisSurat: surat.jenisSurat.namaSurat,
        namaPemohonMasked: surat.pemohonWarga.namaLengkap.replace(/(?<=.).(?=.)/g, '*'),
        nikMasked: surat.pemohonWarga.nikMasked,
        tanggalTerbit: surat.updatedAt.toISOString(),
        instansi: 'Rukun Tetangga 05 / RW 02 Sukamaju, Depok',
      },
      timestamp: new Date().toISOString(),
    });
  });
};
