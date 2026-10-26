import { z } from 'zod';

export enum UserRole {
  SUPERUSER = 'SUPERUSER',
  KETUA_RT = 'KETUA_RT',
  SEKRETARIS = 'SEKRETARIS',
  BENDAHARA = 'BENDAHARA',
  WARGA = 'WARGA',
}

export const UserRoleSchema = z.nativeEnum(UserRole);

/** Roles permitted to mutate tenant data (as opposed to read-only residents). */
export const TENANT_ADMIN_ROLES: readonly UserRole[] = [
  UserRole.SUPERUSER,
  UserRole.KETUA_RT,
  UserRole.SEKRETARIS,
  UserRole.BENDAHARA,
];

/**
 * JWT session payload.
 *
 * `rtId` is the AUTHORITATIVE tenant scope. It is signed, so a client cannot
 * forge it — this is what makes row-level tenant isolation trustworthy.
 * `rtSlug` is carried for cheap display/logging without a DB round-trip.
 */
export interface JwtSessionPayload {
  userId: string;
  wargaId: string;
  kkId: string;
  username: string;
  role: UserRole;
  /** Canonical tenant id (`RukunTetanggaConfig.id`). */
  rtId: string;
  /** Tenant slug, for logging and display only. Never used for authorization. */
  rtSlug?: string;
  iat?: number;
  exp?: number;
}

export const LoginRequestSchema = z.object({
  username: z.string().trim().min(3, 'Username minimal 3 karakter').max(50),
  password: z.string().min(8, 'Password minimal 8 karakter'),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const ClaimInviteTokenSchema = z.object({
  token: z.string().trim().min(8, 'Token aktivasi tidak valid').max(64),
  username: z.string().trim().min(3, 'Username minimal 3 karakter').max(50),
  password: z.string().min(8, 'Password minimal 8 karakter'),
});
export type ClaimInviteTokenRequest = z.infer<typeof ClaimInviteTokenSchema>;

export const VerifyRecoveryCodeSchema = z.object({
  username: z.string().trim(),
  recoveryCode: z.string().trim().length(8, 'Kode pemulihan harus 8 karakter'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter'),
});
export type VerifyRecoveryCodeRequest = z.infer<typeof VerifyRecoveryCodeSchema>;

export const PiiAccessReasonSchema = z.enum([
  'VERIFIKASI_SURAT',
  'PEMUTAKHIRAN_DATA_KK',
  'PENANGANAN_DARURAT',
  'AUDIT_KEAMANAN',
]);
export type PiiAccessReason = z.infer<typeof PiiAccessReasonSchema>;

export const RevealPiiRequestSchema = z.object({
  wargaId: z.string().uuid(),
  field: z.enum(['NIK', 'NO_KK', 'FOTO_KTP', 'FOTO_KK']),
  reason: PiiAccessReasonSchema,
});
export type RevealPiiRequest = z.infer<typeof RevealPiiRequestSchema>;

