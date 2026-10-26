import type { FastifyPluginAsync } from 'fastify';
import { hashPassword, verifyPassword } from '../../infrastructure/crypto/password-hasher.js';
import crypto from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { TenantContextService, TenantAccessError } from '../../infrastructure/tenant/tenant-context.service.js';
import { PlanQuotaService } from '../../infrastructure/tenant/plan-quota.service.js';
import {
  LoginRequestSchema,
  VerifyRecoveryCodeSchema,
  ErrorCode,
  TenantQuotaResource,
  TenantResolutionSource,
  UserRole,
} from '@simrt/shared-types';
import { authenticateJwt, requireRoles } from '../middlewares/auth.middleware.js';
import {
  getTenantContext,
  requireActiveTenant,
  resolveTenantContext,
} from '../middlewares/tenant.middleware.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = PrismaService.getInstance();

  /**
   * POST /api/v1/auth/login
   */
  fastify.post('/login', async (request, reply) => {
    const parseResult = LoginRequestSchema.safeParse(request.body);
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

    const { username, password } = parseResult.data;

    // Optional tenant hints — required when the same username exists in more
    // than one RT (username is unique PER TENANT, not globally).
    const rawBody = (request.body as any) || {};
    const assertedRtId: string | undefined =
      typeof rawBody.rtId === 'string' && rawBody.rtId.trim() ? rawBody.rtId.trim() : undefined;
    const assertedSlug: string | undefined =
      typeof rawBody.rtSlug === 'string' && rawBody.rtSlug.trim()
        ? rawBody.rtSlug.trim().toLowerCase()
        : undefined;

    let scopedRtId: string | undefined;
    if (assertedRtId) {
      const ctx = await TenantContextService.resolve(
        prisma,
        assertedRtId,
        TenantResolutionSource.JWT_CLAIM
      );
      if (!ctx) {
        return reply.status(401).send({
          success: false,
          error: {
            code: ErrorCode.ERR_TENANT_REQUIRED,
            message: 'Komunitas RT yang Anda pilih tidak ditemukan.',
          },
          timestamp: new Date().toISOString(),
        });
      }
      scopedRtId = ctx.rtId;
    } else if (assertedSlug) {
      const ctx = await TenantContextService.resolveBySlug(
        prisma,
        assertedSlug,
        TenantResolutionSource.JWT_CLAIM
      );
      if (!ctx) {
        return reply.status(401).send({
          success: false,
          error: {
            code: ErrorCode.ERR_TENANT_REQUIRED,
            message: 'Komunitas RT yang Anda pilih tidak ditemukan.',
          },
          timestamp: new Date().toISOString(),
        });
      }
      scopedRtId = ctx.rtId;
    }

    // An unscoped lookup may legitimately match accounts in several RTs. We
    // refuse and ask the resident to select their community rather than
    // guessing — guessing is how cross-tenant sessions get issued.
    const candidates = await prisma.user.findMany({
      where: {
        username,
        ...(scopedRtId ? { rtId: scopedRtId } : {}),
      },
      include: { warga: { include: { kk: true } }, rt: true },
      take: 3,
    });

    if (candidates.length > 1) {
      return reply.status(409).send({
        success: false,
        error: {
          code: ErrorCode.ERR_TENANT_REQUIRED,
          message:
            'Username ini terdaftar pada lebih dari satu komunitas RT. Silakan pilih komunitas RT Anda terlebih dahulu.',
          details: candidates.map((c) => ({
            rtId: c.rtId,
            rtSlug: c.rt.slug,
            display: `RT ${c.rt.kodeRt} / RW ${c.rt.kodeRw} — Kel. ${c.rt.namaKelurahan}, ${c.rt.namaKota}`,
          })),
        },
        timestamp: new Date().toISOString(),
      });
    }

    const user = candidates[0];

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: ErrorCode.ERR_UNAUTHORIZED,
          message: 'Username atau password salah.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (60 * 1000));
      return reply.status(429).send({
        success: false,
        error: {
          code: ErrorCode.ERR_RATE_LIMIT_EXCEEDED,
          message: `Akun terkunci sementara karena terlalu banyak percobaan gagal. Silakan coba ${remainingMinutes} menit lagi.`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (!user.isActive) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ErrorCode.ERR_FORBIDDEN,
          message: 'Akun Anda dinonaktifkan. Hubungi Pengurus RT.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      const newFailedAttempts = user.failedAttempts + 1;
      const willLock = newFailedAttempts >= 5;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: newFailedAttempts,
          lockedUntil: willLock ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });

      return reply.status(401).send({
        success: false,
        error: {
          code: ErrorCode.ERR_UNAUTHORIZED,
          message: willLock
            ? 'Akun Anda terkunci selama 15 menit karena 5 kali salah password berturut-turut.'
            : `Password salah. Percobaan ke-${newFailedAttempts} dari 5.`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Reset failed attempts & update last active
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastActiveAt: new Date(),
      },
    });

    // Generate JWT Access & Refresh Tokens.
    // `rtId` is the AUTHORITATIVE tenant scope — signed, so unforgeable, and it
    // is what `resolveTenantContext` trusts for every subsequent request.
    const sessionPayload = {
      userId: user.id,
      wargaId: user.wargaId,
      kkId: user.warga.kkId,
      username: user.username,
      role: user.role as UserRole,
      rtId: user.rtId,
      rtSlug: user.rt.slug,
    };

    const accessToken = fastify.jwt.sign(sessionPayload, { expiresIn: '7d' });
    const refreshToken = fastify.jwt.sign(
      { userId: user.id, rtId: user.rtId },
      { expiresIn: '30d' }
    );

    return reply.send({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          namaLengkap: user.warga.namaLengkap,
          kkId: user.warga.kkId,
          wargaId: user.wargaId,
          rtId: user.rtId,
          rtSlug: user.rt.slug,
        },
        tenant: {
          rtId: user.rtId,
          slug: user.rt.slug,
          planCode: user.rt.planCode,
          status: user.rt.status,
          displayTitle: `RT ${user.rt.kodeRt} / RW ${user.rt.kodeRw}`,
          displaySub: `Kel. ${user.rt.namaKelurahan}, Kec. ${user.rt.namaKecamatan}, ${user.rt.namaKota}`,
        },
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /api/v1/auth/verify-invite (Validate QR Token before setting password)
   */
  fastify.post('/verify-invite', async (request, reply) => {
    const { token } = (request.body as { token?: string }) || {};
    if (!token || typeof token !== 'string') {
      return reply.status(400).send({
        success: false,
        error: { code: ErrorCode.ERR_VALIDATION, message: 'Token aktivasi QR wajib disertakan.' },
        timestamp: new Date().toISOString(),
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const invite = await prisma.onboardingInvite.findUnique({
      where: { tokenHash },
      include: {
        rumah: true,
        kk: {
          include: { warga: true },
        },
      },
    });

    if (!invite || invite.isClaimed || (invite.expiresAt && invite.expiresAt < new Date())) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ErrorCode.ERR_INVALID_INVITE_TOKEN,
          message: 'Token aktivasi QR tidak valid, sudah pernah diklaim, atau telah kedaluwarsa.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    const kepalaKeluarga =
      invite.kk.warga.find((w: any) => w.hubunganKeluarga === 'KEPALA_KELUARGA')?.namaLengkap ||
      invite.kk.warga[0]?.namaLengkap ||
      'Warga RT 05';

    return reply.send({
      success: true,
      data: {
        blokRumah: `${invite.rumah.kodeBlok} No. ${invite.rumah.nomorRumah}`,
        nomorKkMasked: invite.kk.noKkMasked,
        kepalaKeluarga,
        requiresNikVerification: true,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /api/v1/auth/claim-invite (Zero-MDN Onboarding via QR Card with 4-Digit NIK Security Challenge)
   */
  fastify.post('/claim-invite', async (request, reply) => {
    const rawBody = request.body as any;
    const token = rawBody?.token;
    const password = rawBody?.password;
    let username = rawBody?.username;
    const nikVerification = rawBody?.nikVerification || rawBody?.last4Nik;

    if (!token || !password) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ErrorCode.ERR_VALIDATION,
          message: 'Token aktivasi dan password wajib diisi.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    const tokenHash = crypto.createHash('sha256').update(String(token).trim()).digest('hex');

    const invite = await prisma.onboardingInvite.findUnique({
      where: { tokenHash },
      include: {
        rumah: true,
        kk: { include: { warga: true } },
      },
    });

    if (!invite || invite.isClaimed || (invite.expiresAt && invite.expiresAt < new Date())) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ErrorCode.ERR_INVALID_INVITE_TOKEN,
          message: 'Token aktivasi QR tidak valid, sudah pernah diklaim, atau telah kedaluwarsa.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Security Challenge: Verify 4 digits of NIK to prevent unauthorized card scanning
    if (nikVerification && typeof nikVerification === 'string' && nikVerification.trim().length >= 4) {
      const cleanInput = nikVerification.trim().slice(-4);
      const isMatch = invite.kk.warga.some((w: any) => {
        const masked = String(w.nikMasked || '');
        return masked.endsWith(cleanInput);
      });

      if (!isMatch) {
        return reply.status(403).send({
          success: false,
          error: {
            code: ErrorCode.ERR_FORBIDDEN,
            message: 'Verifikasi keamanan gagal: 4 digit terakhir NIK tidak cocok dengan data anggota Kartu Keluarga ini.',
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Auto-generate clean username if omitted by resident.
    // Username uniqueness is scoped to the invite's tenant — a resident of RT A
    // must be free to pick the same username as a resident of RT B.
    const inviteRtId: string = invite.rtId;
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      const cleanBlok = invite.rumah.kodeBlok.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanNo = invite.rumah.nomorRumah.toLowerCase().replace(/[^a-z0-9]/g, '');
      username = `warga_${cleanBlok}_${cleanNo}`;
      const existing = await prisma.user.findUnique({
        where: { rtId_username: { rtId: inviteRtId, username: String(username) } },
      });
      if (existing) {
        username = `${username}_${Math.floor(100 + Math.random() * 900)}`;
      }
    } else {
      username = username.trim();
      const existingUser = await prisma.user.findUnique({
        where: { rtId_username: { rtId: inviteRtId, username: String(username) } },
      });
      if (existingUser) {
        return reply.status(409).send({
          success: false,
          error: {
            code: ErrorCode.ERR_CONFLICT,
            message: 'Username sudah digunakan di komunitas RT ini. Silakan pilih username lain.',
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Pick head of family or first resident in KK
    const kepalaWarga =
      invite.kk.warga.find((w: any) => w.hubunganKeluarga === 'KEPALA_KELUARGA') || invite.kk.warga[0];

    if (!kepalaWarga) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ErrorCode.ERR_NOT_FOUND,
          message: 'Data anggota keluarga belum terdaftar di Kartu Keluarga ini. Hubungi Sekretaris RT.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    const passwordHash = await hashPassword(password);

    // Transaction to create User, generate 8 recovery codes, and mark invite claimed
    const result = await prisma.$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
        data: {
          rtId: inviteRtId,
          wargaId: kepalaWarga.id,
          username,
          passwordHash,
          role: 'WARGA',
          isActive: true,
        },
      });

      // Generate 8 offline recovery codes
      const rawRecoveryCodes: string[] = [];
      for (let i = 1; i <= 8; i++) {
        const rawCode = `RC${i}${Math.floor(100000 + Math.random() * 900000)}`.substring(0, 8);
        rawRecoveryCodes.push(rawCode);
        const codeHash = await hashPassword(rawCode);
        await tx.recoveryCode.create({
          data: {
            rtId: inviteRtId,
            userId: newUser.id,
            codeHash,
          },
        });
      }

      await tx.onboardingInvite.update({
        where: { id: invite.id },
        data: {
          isClaimed: true,
          claimedByUserId: newUser.id,
          claimedAt: new Date(),
        },
      });

      return { newUser, rawRecoveryCodes };
    });

    const inviteTenantSlug = (
      await prisma.rukunTetanggaConfig.findUnique({
        where: { id: inviteRtId },
        select: { slug: true },
      })
    )?.slug;

    const sessionPayload = {
      userId: result.newUser.id,
      wargaId: kepalaWarga.id,
      kkId: invite.kkId,
      username: result.newUser.username,
      role: UserRole.WARGA,
      rtId: inviteRtId,
      rtSlug: inviteTenantSlug,
    };

    const accessToken = fastify.jwt.sign(sessionPayload, { expiresIn: '7d' });
    const refreshToken = fastify.jwt.sign(
      { userId: result.newUser.id, rtId: inviteRtId },
      { expiresIn: '30d' }
    );

    return reply.send({
      success: true,
      data: {
        accessToken,
        refreshToken,
        recoveryCodes: result.rawRecoveryCodes,
        user: {
          id: result.newUser.id,
          username: result.newUser.username,
          role: result.newUser.role,
          namaLengkap: kepalaWarga.namaLengkap,
          rtId: inviteRtId,
        },
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /api/v1/auth/verify-recovery (Password reset with 8-digit offline code)
   */
  fastify.post('/verify-recovery', async (request, reply) => {
    const parseResult = VerifyRecoveryCodeSchema.safeParse(request.body);
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

    const { username, recoveryCode, newPassword } = parseResult.data;

    // Recovery must be tenant-scoped: `username` is unique only WITHIN an RT,
    // so an unscoped lookup could reset another community's account.
    const recoveryBody = (request.body as any) || {};
    const recRtId =
      typeof recoveryBody.rtId === 'string' && recoveryBody.rtId.trim()
        ? recoveryBody.rtId.trim()
        : undefined;
    const recSlug =
      typeof recoveryBody.rtSlug === 'string' && recoveryBody.rtSlug.trim()
        ? recoveryBody.rtSlug.trim().toLowerCase()
        : undefined;

    let recScopedRtId: string | undefined = recRtId;
    if (!recScopedRtId && recSlug) {
      const ctx = await TenantContextService.resolveBySlug(
        prisma,
        recSlug,
        TenantResolutionSource.JWT_CLAIM
      );
      recScopedRtId = ctx?.rtId;
    }

    const recoveryMatches = await prisma.user.findMany({
      where: { username, ...(recScopedRtId ? { rtId: recScopedRtId } : {}) },
      include: { recoveryCodes: { where: { isUsed: false } } },
      take: 3,
    });

    if (recoveryMatches.length > 1) {
      return reply.status(409).send({
        success: false,
        error: {
          code: ErrorCode.ERR_TENANT_REQUIRED,
          message:
            'Username ini terdaftar pada lebih dari satu komunitas RT. Sertakan rtSlug komunitas RT Anda.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    const user = recoveryMatches[0];

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: {
          code: ErrorCode.ERR_NOT_FOUND,
          message: 'Akun tidak ditemukan.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Verify code against unused recovery code hashes
    let matchedCodeId: string | null = null;
    for (const codeRecord of user.recoveryCodes) {
      const isMatch = await verifyPassword(recoveryCode, codeRecord.codeHash);
      if (isMatch) {
        matchedCodeId = codeRecord.id;
        break;
      }
    }

    if (!matchedCodeId) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ErrorCode.ERR_RECOVERY_CODE_INVALID,
          message: 'Kode pemulihan salah atau sudah pernah digunakan sebelumnya.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Update password and mark code used
    const newPasswordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
          failedAttempts: 0,
          lockedUntil: null,
        },
      }),
      prisma.recoveryCode.update({
        where: { id: matchedCodeId },
        data: {
          isUsed: true,
          usedAt: new Date(),
        },
      }),
    ]);

    return reply.send({
      success: true,
      data: {
        message: 'Password berhasil direset. Silakan login kembali dengan password baru Anda.',
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /api/v1/auth/me
   */
  fastify.get('/me', { preHandler: [authenticateJwt] }, async (request, reply) => {
    const session = request.userSession!;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        warga: {
          include: {
            kk: {
              include: { rumah: true },
            },
          },
        },
      },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: {
          code: ErrorCode.ERR_NOT_FOUND,
          message: 'Data pengguna tidak ditemukan.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.send({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        warga: {
          id: user.warga.id,
          namaLengkap: user.warga.namaLengkap,
          nikMasked: user.warga.nikMasked,
          gender: user.warga.gender,
          golonganDarah: user.warga.golonganDarah,
          alamatDomisili: user.warga.kk.rumah.alamat,
          blokRumah: `${user.warga.kk.rumah.kodeBlok} No. ${user.warga.kk.rumah.nomorRumah}`,
        },
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /api/v1/auth/create-user-account (Admin provisions login credentials directly for any family member)
   */
  fastify.post(
    '/create-user-account',
    {
      preHandler: [
        authenticateJwt,
        resolveTenantContext,
        requireActiveTenant,
        requireRoles([UserRole.KETUA_RT, UserRole.SEKRETARIS]),
      ],
    },
    async (request, reply) => {
      const { wargaId, username, password, role } = (request.body as any) || {};
      const tenant = getTenantContext(request);

      if (!wargaId || !username) {
        return reply.status(400).send({
          success: false,
          error: { code: ErrorCode.ERR_VALIDATION, message: 'Warga dan username wajib diisi.' },
          timestamp: new Date().toISOString(),
        });
      }

      const cleanUsername = String(username).trim().toLowerCase();
      if (cleanUsername.length < 3) {
        return reply.status(400).send({
          success: false,
          error: { code: ErrorCode.ERR_VALIDATION, message: 'Username minimal 3 karakter.' },
          timestamp: new Date().toISOString(),
        });
      }

      const warga = await prisma.warga.findUnique({
        where: { id: wargaId },
        include: { users: true, kk: { include: { rumah: true } } },
      });

      // Anti-IDOR: an RT may only provision accounts for its OWN residents.
      if (!warga || warga.rtId !== tenant.rtId) {
        return reply.status(404).send({
          success: false,
          error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Data warga tidak ditemukan.' },
          timestamp: new Date().toISOString(),
        });
      }

      if (!warga.users && (!password || String(password).length < 8)) {
        return reply.status(400).send({
          success: false,
          error: { code: ErrorCode.ERR_VALIDATION, message: 'Password minimal 8 karakter untuk akun baru.' },
          timestamp: new Date().toISOString(),
        });
      }

      if (password && String(password).length > 0 && String(password).length < 8) {
        return reply.status(400).send({
          success: false,
          error: { code: ErrorCode.ERR_VALIDATION, message: 'Password minimal 8 karakter.' },
          timestamp: new Date().toISOString(),
        });
      }

      const existingUser = await prisma.user.findUnique({
        where: { rtId_username: { rtId: tenant.rtId, username: cleanUsername } },
      });
      if (existingUser && existingUser.wargaId !== wargaId) {
        return reply.status(409).send({
          success: false,
          error: { code: ErrorCode.ERR_CONFLICT, message: 'Username sudah digunakan oleh akun lain.' },
          timestamp: new Date().toISOString(),
        });
      }

      // Determine target role with security check
      let targetRole: UserRole = warga.users ? (warga.users.role as UserRole) : UserRole.WARGA;
      if (role && Object.values(UserRole).includes(role)) {
        if (role === UserRole.SUPERUSER && request.userSession?.role !== UserRole.SUPERUSER) {
          return reply.status(403).send({
            success: false,
            error: { code: ErrorCode.ERR_FORBIDDEN, message: 'Hanya Superuser yang dapat menetapkan role Superuser.' },
            timestamp: new Date().toISOString(),
          });
        }
        targetRole = role as UserRole;
      }

      // Growing the number of PRIVILEGED accounts consumes the tenant's plan
      // quota. Resident (WARGA) accounts are unlimited.
      const promotingToPrivileged =
        targetRole !== UserRole.WARGA &&
        (!warga.users || warga.users.role === UserRole.WARGA);
      if (promotingToPrivileged) {
        try {
          await PlanQuotaService.assertAvailable(
            prisma,
            tenant,
            TenantQuotaResource.ADMIN_USERS,
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
      }

      let user;
      if (warga.users) {
        // Update existing user
        const updateData: any = {
          username: cleanUsername,
          role: targetRole,
          failedAttempts: 0,
          lockedUntil: null,
          isActive: true,
        };

        if (password && String(password).trim().length >= 8) {
          updateData.passwordHash = await hashPassword(String(password).trim());
        }

        user = await prisma.user.update({
          where: { id: warga.users.id },
          data: updateData,
        });
      } else {
        // Create new User account and generate recovery codes
        const passwordHash = await hashPassword(String(password).trim());
        user = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              rtId: tenant.rtId,
              wargaId: warga.id,
              username: cleanUsername,
              passwordHash,
              role: targetRole,
              isActive: true,
            },
          });

          // Generate 8 offline emergency recovery codes
          for (let i = 1; i <= 8; i++) {
            const rawCode = `RC${i}${Math.floor(100000 + Math.random() * 900000)}`.substring(0, 8);
            const codeHash = await hashPassword(rawCode);
            await tx.recoveryCode.create({
              data: {
                rtId: tenant.rtId,
                userId: newUser.id,
                codeHash,
              },
            });
          }

          return newUser;
        });
      }

      return reply.send({
        success: true,
        data: {
          id: user.id,
          rtId: user.rtId,
          username: user.username,
          namaLengkap: warga.namaLengkap,
          role: user.role,
        },
        timestamp: new Date().toISOString(),
      });
    }
  );
};

