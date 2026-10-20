import type { FastifyPluginAsync } from 'fastify';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { authenticateJwt, requireRoles } from '../middlewares/auth.middleware.js';
import { UserRole, ErrorCode } from '@simrt/shared-types';
import { Ed25519SignerAdapter } from '../../infrastructure/crypto/ed25519-signer.adapter.js';
import { EnvelopeCryptoAdapter } from '../../infrastructure/crypto/envelope-crypto.adapter.js';

export const configRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = PrismaService.getInstance();
  const signerAdapter = new Ed25519SignerAdapter();
  const cryptoAdapter = new EnvelopeCryptoAdapter();

  /**
   * Helper: Get or initialize active RT Configuration
   */
  async function getOrCreateRtConfig() {
    let config = await prisma.rukunTetanggaConfig.findFirst();
    if (!config) {
      const { publicKeyPem, privateKeyPem } = signerAdapter.generateKeyPair();
      const encryptedPrivateKey = cryptoAdapter.encryptField(privateKeyPem);

      config = await prisma.rukunTetanggaConfig.create({
        data: {
          kodeRt: '010',
          kodeRw: '003',
          namaKelurahan: 'Taman Bunga',
          namaKecamatan: 'Gerunggang',
          namaKota: 'Kota Pangkalpinang',
          kodePos: '33119',
          ed25519PublicKey: publicKeyPem,
          ed25519PrivateKeyEnc: encryptedPrivateKey,
        },
      });
    }
    return config;
  }

  /**
   * GET /api/v1/config/rt (Public - for Admin Panel, Login, and Mobile Resident App)
   */
  fastify.get('/rt', async (_request, reply) => {
    const config = await getOrCreateRtConfig();

    return reply.send({
      success: true,
      data: {
        id: config.id,
        kodeRt: config.kodeRt,
        kodeRw: config.kodeRw,
        namaKelurahan: config.namaKelurahan,
        namaKecamatan: config.namaKecamatan,
        namaKota: config.namaKota,
        kodePos: config.kodePos,
        ed25519PublicKey: config.ed25519PublicKey,
        displayTitle: `RT ${config.kodeRt} / RW ${config.kodeRw}`,
        displaySub: `Kel. ${config.namaKelurahan}, Kec. ${config.namaKecamatan}, ${config.namaKota}`,
        displayFull: `RT ${config.kodeRt} / RW ${config.kodeRw} Kel. ${config.namaKelurahan}, Kec. ${config.namaKecamatan}, ${config.namaKota} ${config.kodePos}`,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * PUT /api/v1/config/rt (Admin/Superuser update RT Profile & Location)
   */
  fastify.put(
    '/rt',
    { preHandler: [authenticateJwt, requireRoles([UserRole.KETUA_RT])] },
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

      const existingConfig = await getOrCreateRtConfig();

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

      // Record audit log
      await prisma.auditLog.create({
        data: {
          actorUserId: request.userSession?.userId || 'system',
          actorRole: request.userSession?.role || 'SUPERUSER',
          action: 'UPDATE_RT_CONFIG',
          tableName: 'rukun_tetangga_config',
          recordId: updated.id,
          ipAddress: request.ip || '127.0.0.1',
          userAgent: request.headers['user-agent'] || 'SIM-RT Web',
          metadata: {
            old: {
              kodeRt: existingConfig.kodeRt,
              kodeRw: existingConfig.kodeRw,
              namaKelurahan: existingConfig.namaKelurahan,
              namaKecamatan: existingConfig.namaKecamatan,
              namaKota: existingConfig.namaKota,
            },
            new: {
              kodeRt: updated.kodeRt,
              kodeRw: updated.kodeRw,
              namaKelurahan: updated.namaKelurahan,
              namaKecamatan: updated.namaKecamatan,
              namaKota: updated.namaKota,
            },
          },
        },
      }).catch(() => {});

      return reply.send({
        success: true,
        data: {
          id: updated.id,
          kodeRt: updated.kodeRt,
          kodeRw: updated.kodeRw,
          namaKelurahan: updated.namaKelurahan,
          namaKecamatan: updated.namaKecamatan,
          namaKota: updated.namaKota,
          kodePos: updated.kodePos,
          displayTitle: `RT ${updated.kodeRt} / RW ${updated.kodeRw}`,
          displaySub: `Kel. ${updated.namaKelurahan}, Kec. ${updated.namaKecamatan}, ${updated.namaKota}`,
          displayFull: `RT ${updated.kodeRt} / RW ${updated.kodeRw} Kel. ${updated.namaKelurahan}, Kec. ${updated.namaKecamatan}, ${updated.namaKota} ${updated.kodePos}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
  );
};
