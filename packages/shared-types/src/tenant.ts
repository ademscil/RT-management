import { z } from 'zod';

/**
 * ==============================================================================
 * MULTI-TENANCY CONTRACT — SINGLE SOURCE OF TRUTH
 * ==============================================================================
 * A "Tenant" in SIM-RT is a single RT/RW community (Rukun Tetangga).
 * The canonical tenant identifier is `RukunTetanggaConfig.id`, exposed to
 * clients as `rtId`.
 *
 * SECURITY INVARIANT (enforced by every backend route):
 *   Tenant scope is ALWAYS derived from the authenticated JWT `rtId` claim.
 *   The `x-rt-id` header is honoured ONLY as a cross-tenant assertion for
 *   SUPERUSER accounts. A mismatch for any other role is rejected with
 *   ERR_TENANT_MISMATCH — never silently honoured.
 * ==============================================================================
 */

export enum TenantStatus {
  /** Fully provisioned and operational. */
  ACTIVE = 'ACTIVE',
  /** Created but pending subscription activation. */
  PENDING = 'PENDING',
  /** Past-due: read-only, no new data creation permitted. */
  SUSPENDED = 'SUSPENDED',
  /** Explicitly deactivated by a SUPERUSER. */
  ARCHIVED = 'ARCHIVED',
}

export const TenantStatusSchema = z.nativeEnum(TenantStatus);

/**
 * Subscription plan codes.
 * FREE                 → max 50 KK, basic kependudukan only (COSS community tier).
 * PRO_RT               → unlimited KK, e-signature, push notifications.
 * ENTERPRISE_KELURAHAN → multi-RT (RW/Kelurahan) consolidated dashboard.
 */
export enum PlanCode {
  FREE = 'FREE',
  PRO_RT = 'PRO_RT',
  ENTERPRISE_KELURAHAN = 'ENTERPRISE_KELURAHAN',
}

export const PlanCodeSchema = z.nativeEnum(PlanCode);

/** Quota window granularity for a plan. */
export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL',
  /** No expiry — used by the FREE tier. */
  LIFETIME = 'LIFETIME',
}

export const BillingCycleSchema = z.nativeEnum(BillingCycle);

/** Billing cycles that require payment (everything except LIFETIME). */
export enum PaidBillingCycle {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL',
}

export const PaidBillingCycleSchema = z.nativeEnum(PaidBillingCycle);

/**
 * Feature flags unlocked per plan. Declared as a readonly tuple so the frontend
 * can iterate it when rendering upgrade prompts.
 */
export const TENANT_FEATURES = [
  'KEPENDUDUKAN_DASAR',
  'KAS_LEDGER',
  'E_SURAT_DIGITAL',
  'TANDA_TANGAN_ED25519',
  'PUSH_NOTIFICATION',
  'MULTI_RT_DASHBOARD',
  'CUSTOM_BRANDING',
  'API_ACCESS',
  'PRIORITY_SUPPORT',
] as const;

export type TenantFeature = (typeof TENANT_FEATURES)[number];
export const TenantFeatureSchema = z.enum(TENANT_FEATURES);

/** Plan → feature matrix. Shared by API guards and UI gating. */
export const PLAN_FEATURE_MATRIX: Record<PlanCode, readonly TenantFeature[]> = {
  [PlanCode.FREE]: ['KEPENDUDUKAN_DASAR', 'KAS_LEDGER'],
  [PlanCode.PRO_RT]: [
    'KEPENDUDUKAN_DASAR',
    'KAS_LEDGER',
    'E_SURAT_DIGITAL',
    'TANDA_TANGAN_ED25519',
    'PUSH_NOTIFICATION',
    'CUSTOM_BRANDING',
  ],
  [PlanCode.ENTERPRISE_KELURAHAN]: [...TENANT_FEATURES],
};

/** Plan → numeric quota matrix. `null` means unlimited. */
export interface PlanQuotaDefinition {
  maxKartuKeluarga: number | null;
  maxWarga: number | null;
  /** `null` means unlimited. */
  maxAdminUsers: number | null;
  /** Maximum vault storage in megabytes. `null` means unlimited. */
  maxStorageMb: number | null;
  /** Number of child RTs a tenant may consolidate (ENTERPRISE only). */
  maxChildTenants: number;
}

export const PLAN_QUOTA_MATRIX: Record<PlanCode, PlanQuotaDefinition> = {
  [PlanCode.FREE]: {
    maxKartuKeluarga: 50,
    maxWarga: 250,
    maxAdminUsers: 3,
    maxStorageMb: 512,
    maxChildTenants: 0,
  },
  [PlanCode.PRO_RT]: {
    maxKartuKeluarga: null,
    maxWarga: null,
    maxAdminUsers: 15,
    maxStorageMb: 10240,
    maxChildTenants: 0,
  },
  [PlanCode.ENTERPRISE_KELURAHAN]: {
    maxKartuKeluarga: null,
    maxWarga: null,
    maxAdminUsers: null,
    maxStorageMb: null,
    maxChildTenants: 50,
  },
};

/** Human-facing plan catalogue entry (pricing UI + API). */
export interface PlanCatalogueEntry {
  code: PlanCode;
  name: string;
  tagline: string;
  billingCycle: BillingCycle;
  /** Price in IDR. 0 for the free tier. */
  priceIdr: number;
  /** Midtrans product SKU written into `item_details[].id`. */
  midtransSku: string;
  quota: PlanQuotaDefinition;
  features: readonly TenantFeature[];
}

export const PLAN_CATALOGUE: readonly PlanCatalogueEntry[] = [
  {
    code: PlanCode.FREE,
    name: 'Community',
    tagline: 'Gratis selamanya untuk RT skala kecil',
    billingCycle: BillingCycle.LIFETIME,
    priceIdr: 0,
    midtransSku: 'SIMRT-FREE',
    quota: PLAN_QUOTA_MATRIX[PlanCode.FREE],
    features: PLAN_FEATURE_MATRIX[PlanCode.FREE],
  },
  {
    code: PlanCode.PRO_RT,
    name: 'PRO RT',
    tagline: 'Kuota tanpa batas + E-Surat Tanda Tangan Digital',
    billingCycle: BillingCycle.MONTHLY,
    priceIdr: 149000,
    midtransSku: 'SIMRT-PRO-RT',
    quota: PLAN_QUOTA_MATRIX[PlanCode.PRO_RT],
    features: PLAN_FEATURE_MATRIX[PlanCode.PRO_RT],
  },
  {
    code: PlanCode.ENTERPRISE_KELURAHAN,
    name: 'Enterprise Kelurahan',
    tagline: 'Dashboard multi-RT terpusat untuk RW / Kelurahan',
    billingCycle: BillingCycle.MONTHLY,
    priceIdr: 899000,
    midtransSku: 'SIMRT-ENT-KEL',
    quota: PLAN_QUOTA_MATRIX[PlanCode.ENTERPRISE_KELURAHAN],
    features: PLAN_FEATURE_MATRIX[PlanCode.ENTERPRISE_KELURAHAN],
  },
];

export function getPlanCatalogueEntry(code: PlanCode): PlanCatalogueEntry | undefined {
  return PLAN_CATALOGUE.find((p) => p.code === code);
}

export function getPlanQuota(code: PlanCode): PlanQuotaDefinition {
  return PLAN_QUOTA_MATRIX[code] ?? PLAN_QUOTA_MATRIX[PlanCode.FREE];
}

export function planHasFeature(code: PlanCode, feature: TenantFeature): boolean {
  return PLAN_FEATURE_MATRIX[code]?.includes(feature) ?? false;
}

// ==============================================================================
// TRANSPORT — tenant resolution
// ==============================================================================

/** Header carrying an explicit tenant assertion (cross-tenant SUPERUSER only). */
export const TENANT_HEADER = 'x-rt-id';

/** How the active tenant for a request was determined. */
export enum TenantResolutionSource {
  /** Derived from the signed JWT `rtId` claim. Authoritative. */
  JWT_CLAIM = 'JWT_CLAIM',
  /** Explicit header assertion by a SUPERUSER. */
  SUPERUSER_HEADER = 'SUPERUSER_HEADER',
  /** Public/unauthenticated route resolving the default active tenant. */
  PUBLIC_DEFAULT = 'PUBLIC_DEFAULT',
}

export const TenantResolutionSourceSchema = z.nativeEnum(TenantResolutionSource);

/**
 * The contextual tenant bound to a request. Injected by the `resolveTenantContext`
 * middleware and consumed by every tenant-scoped route handler.
 */
export interface TenantContext {
  /** Canonical tenant id — `RukunTetanggaConfig.id`. */
  rtId: string;
  slug: string;
  kodeRt: string;
  kodeRw: string;
  namaKelurahan: string;
  namaKecamatan: string;
  namaKota: string;
  status: TenantStatus;
  planCode: PlanCode;
  /** True while the tenant is inside a paid trial window. */
  isTrialing: boolean;
  /** ISO-8601 expiry of the active subscription. `null` for FREE/LIFETIME. */
  subscriptionEndsAt: string | null;
  /** Source that produced this context. Recorded into the audit trail. */
  resolutionSource: TenantResolutionSource;
}

/** Compact tenant descriptor for list/switch UI. */
export interface TenantSummary {
  rtId: string;
  slug: string;
  kodeRt: string;
  kodeRw: string;
  namaKelurahan: string;
  namaKecamatan: string;
  namaKota: string;
  status: TenantStatus;
  planCode: PlanCode;
  displayTitle: string;
  displaySub: string;
  displayFull: string;
}

export function buildTenantDisplay(
  t: Pick<TenantSummary, 'kodeRt' | 'kodeRw' | 'namaKelurahan' | 'namaKecamatan' | 'namaKota'> & {
    kodePos?: string;
  }
): Pick<TenantSummary, 'displayTitle' | 'displaySub' | 'displayFull'> {
  const displayTitle = `RT ${t.kodeRt} / RW ${t.kodeRw}`;
  const displaySub = `Kel. ${t.namaKelurahan}, Kec. ${t.namaKecamatan}, ${t.namaKota}`;
  const pos = t.kodePos ? ` ${t.kodePos}` : '';
  return {
    displayTitle,
    displaySub,
    displayFull: `${displayTitle} ${displaySub}${pos}`,
  };
}

// ==============================================================================
// REQUEST CONTRACTS
// ==============================================================================

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/** Reserved slugs that must never be claimable by a tenant. */
export const RESERVED_TENANT_SLUGS: readonly string[] = [
  'api',
  'admin',
  'app',
  'www',
  'health',
  'config',
  'auth',
  'static',
  'assets',
  'billing',
  'webhook',
  'superuser',
  'system',
];

export const TenantSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Slug minimal 3 karakter')
  .max(40, 'Slug maksimal 40 karakter')
  .regex(SLUG_PATTERN, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung')
  .refine((v) => !RESERVED_TENANT_SLUGS.includes(v), 'Slug tersebut dicadangkan oleh sistem');

export const CreateTenantSchema = z.object({
  slug: TenantSlugSchema,
  kodeRt: z.string().trim().min(1, 'Kode RT wajib diisi').max(10),
  kodeRw: z.string().trim().min(1, 'Kode RW wajib diisi').max(10),
  namaKelurahan: z.string().trim().min(2, 'Nama kelurahan wajib diisi').max(100),
  namaKecamatan: z.string().trim().min(2, 'Nama kecamatan wajib diisi').max(100),
  namaKota: z.string().trim().min(2, 'Nama kota wajib diisi').max(100),
  kodePos: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'Kode pos harus 5 digit angka')
    .default('00000'),
  planCode: PlanCodeSchema.default(PlanCode.FREE),
  /** Optional parent tenant for ENTERPRISE consolidation. */
  parentTenantId: z.string().uuid().nullish(),
  /** Identity used to bootstrap the first KETUA_RT account. */
  adminUsername: z.string().trim().min(3, 'Username admin minimal 3 karakter').max(50),
  adminPassword: z.string().min(8, 'Password admin minimal 8 karakter').max(128),
  adminNamaLengkap: z.string().trim().min(2, 'Nama lengkap admin wajib diisi').max(100),
});
export type CreateTenantInput = z.infer<typeof CreateTenantSchema>;

export const UpdateTenantSchema = z.object({
  kodeRt: z.string().trim().min(1).max(10).optional(),
  kodeRw: z.string().trim().min(1).max(10).optional(),
  namaKelurahan: z.string().trim().min(2).max(100).optional(),
  namaKecamatan: z.string().trim().min(2).max(100).optional(),
  namaKota: z.string().trim().min(2).max(100).optional(),
  kodePos: z.string().trim().regex(/^\d{5}$/, 'Kode pos harus 5 digit angka').optional(),
  status: TenantStatusSchema.optional(),
});
export type UpdateTenantInput = z.infer<typeof UpdateTenantSchema>;

export const SwitchTenantSchema = z.object({
  rtId: z.string().uuid('ID komunitas RT tidak valid'),
});
export type SwitchTenantInput = z.infer<typeof SwitchTenantSchema>;

export const TenantQueryFilterSchema = z.object({
  status: TenantStatusSchema.optional(),
  planCode: PlanCodeSchema.optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type TenantQueryFilter = z.infer<typeof TenantQueryFilterSchema>;

// ==============================================================================
// RESPONSE CONTRACTS
// ==============================================================================

/** Current consumption snapshot, used to render quota meters in the UI. */
export interface TenantUsageSnapshot {
  totalKartuKeluarga: number;
  totalWarga: number;
  totalAdminUsers: number;
  storageUsedMb: number;
  quota: PlanQuotaDefinition;
  /** Convenience flags so the UI need not recompute. */
  isKartuKeluargaQuotaExceeded: boolean;
  isWargaQuotaExceeded: boolean;
  isStorageQuotaExceeded: boolean;
}

export interface TenantDetailResponse {
  tenant: TenantSummary;
  usage: TenantUsageSnapshot;
  /** ISO-8601 deadline before hard suspension. `null` when not in grace. */
  gracePeriodEndsAt: string | null;
}

/** Quota resources that can be exhausted by a mutating request. */
export enum TenantQuotaResource {
  KARTU_KELUARGA = 'KARTU_KELUARGA',
  WARGA = 'WARGA',
  ADMIN_USERS = 'ADMIN_USERS',
  STORAGE = 'STORAGE',
  CHILD_TENANT = 'CHILD_TENANT',
}

export const TenantQuotaResourceSchema = z.nativeEnum(TenantQuotaResource);

/** Maps a quota resource to the human label shown in the upgrade prompt. */
export function quotaResourceLabel(resource: TenantQuotaResource): string {
  switch (resource) {
    case TenantQuotaResource.KARTU_KELUARGA:
      return 'Kartu Keluarga';
    case TenantQuotaResource.WARGA:
      return 'Data Warga';
    case TenantQuotaResource.ADMIN_USERS:
      return 'Akun Pengurus';
    case TenantQuotaResource.STORAGE:
      return 'Penyimpanan Dokumen';
    case TenantQuotaResource.CHILD_TENANT:
      return 'Komunitas RT Cabang';
    default:
      return 'Kuota';
  }
}

/** Read the effective numeric limit for a resource from a quota definition. */
export function quotaLimitForResource(
  quota: PlanQuotaDefinition,
  resource: TenantQuotaResource
): number | null {
  switch (resource) {
    case TenantQuotaResource.KARTU_KELUARGA:
      return quota.maxKartuKeluarga;
    case TenantQuotaResource.WARGA:
      return quota.maxWarga;
    case TenantQuotaResource.ADMIN_USERS:
      return quota.maxAdminUsers;
    case TenantQuotaResource.STORAGE:
      return quota.maxStorageMb;
    case TenantQuotaResource.CHILD_TENANT:
      return quota.maxChildTenants;
    default:
      return null;
  }
}

/**
 * Derive a deterministic, URL-safe slug from an RT's civic identity.
 *
 * Example: ('010', '003', 'Taman Bunga', 'Kota Pangkalpinang')
 *       → 'rt010-rw003-taman-bunga-pangkalpinang'
 *
 * The result is deterministically truncated to fit `TenantSlugSchema`. Callers
 * MUST still resolve collisions (`ensureUniqueSlug`) because two different
 * kelurahan can share a name in different kecamatan.
 */
export function slugifyTenantIdentity(
  kodeRt: string,
  kodeRw: string,
  namaKelurahan: string,
  namaKota: string
): string {
  const clean = (v: string) =>
    v
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const rt = clean(kodeRt) || '0';
  const rw = clean(kodeRw) || '0';
  // Drop the administrative prefix so "Kota Pangkalpinang" → "pangkalpinang".
  const kota = clean(namaKota.replace(/^(kota|kabupaten|kab\.?)\s+/i, '')) || 'kota';
  const kel = clean(namaKelurahan) || 'kelurahan';

  const base = `rt${rt}-rw${rw}-${kel}-${kota}`;
  // Trim to the 40-char schema ceiling, then strip a dangling separator.
  return base.slice(0, 40).replace(/-+$/g, '');
}

/**
 * Append a short numeric suffix to make a slug unique against `taken`.
 * Returns the first candidate that is free, or throws when `taken` is not an
 * array-like of slugs.
 */
export function ensureUniqueSlug(base: string, taken: readonly string[]): string {
  const used = new Set(taken.map((t) => t.toLowerCase()));
  const trimmed = base.slice(0, 40).replace(/-+$/g, '');
  if (!used.has(trimmed)) return trimmed;

  for (let i = 2; i <= 9999; i++) {
    const suffix = `-${i}`;
    const candidate = `${trimmed.slice(0, 40 - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error('[tenant] Unable to derive a unique tenant slug.');
}
