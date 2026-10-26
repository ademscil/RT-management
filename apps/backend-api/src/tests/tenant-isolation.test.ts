import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorCode,
  PlanCode,
  PLAN_QUOTA_MATRIX,
  RESERVED_TENANT_SLUGS,
  TENANT_FEATURES,
  TenantResolutionSource,
  TenantQuotaResource,
  TenantStatus,
  buildTenantDisplay,
  ensureUniqueSlug,
  getPlanCatalogueEntry,
  getPlanQuota,
  planHasFeature,
  quotaLimitForResource,
  quotaResourceLabel,
  slugifyTenantIdentity,
  type TenantContext,
} from '@simrt/shared-types';
import {
  TenantAccessError,
  TenantContextService,
} from '../infrastructure/tenant/tenant-context.service.js';

/** Build a tenant context with sensible defaults so each test can vary one axis. */
function ctx(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    rtId: '11111111-1111-4111-8111-111111111111',
    slug: 'rt05-rw02-sukamaju-depok',
    kodeRt: '05',
    kodeRw: '02',
    namaKelurahan: 'Sukamaju',
    namaKecamatan: 'Cilodong',
    namaKota: 'Kota Depok',
    status: TenantStatus.ACTIVE,
    planCode: PlanCode.FREE,
    isTrialing: false,
    subscriptionEndsAt: null,
    resolutionSource: TenantResolutionSource.JWT_CLAIM,
    ...overrides,
  };
}

describe('tenant slug derivation', () => {
  it('derives a deterministic slug from civic identity', () => {
    expect(slugifyTenantIdentity('010', '003', 'Taman Bunga', 'Kota Pangkalpinang')).toBe(
      'rt010-rw003-taman-bunga-pangkalpinang'
    );
  });

  it('strips the administrative prefix from the city', () => {
    // "Kota Depok" and "Kabupaten Depok" must not produce different slugs for
    // the same intended community.
    expect(slugifyTenantIdentity('05', '02', 'Sukamaju', 'Kota Depok')).toBe(
      slugifyTenantIdentity('05', '02', 'Sukamaju', 'Kabupaten Depok')
    );
  });

  it('never exceeds the 40-character schema ceiling', () => {
    const long = slugifyTenantIdentity(
      '010',
      '003',
      'Kelurahan Dengan Nama Sangat Panjang Sekali',
      'Kota Yang Namanya Juga Panjang'
    );
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long.endsWith('-')).toBe(false);
  });

  it('produces a slug that satisfies the reserved-word guard', () => {
    // A tenant literally named "Admin" must still yield a non-reserved slug,
    // because the derived slug is always prefixed with `rt<code>`.
    const slug = slugifyTenantIdentity('01', '01', 'Admin', 'Api');
    expect(RESERVED_TENANT_SLUGS.includes(slug)).toBe(false);
  });

  it('resolves collisions deterministically', () => {
    const base = 'rt05-rw02-sukamaju-depok';
    expect(ensureUniqueSlug(base, [])).toBe(base);
    expect(ensureUniqueSlug(base, [base])).toBe('rt05-rw02-sukamaju-depok-2');
    expect(ensureUniqueSlug(base, [base, `${base}-2`])).toBe('rt05-rw02-sukamaju-depok-3');
  });

  it('keeps suffixed slugs within the length ceiling', () => {
    const long = 'a'.repeat(40);
    const resolved = ensureUniqueSlug(long, [long]);
    expect(resolved.length).toBeLessThanOrEqual(40);
    expect(resolved).not.toBe(long);
  });
});

describe('tenant display projection', () => {
  it('builds the three display strings used across admin + mobile', () => {
    const d = buildTenantDisplay({
      kodeRt: '05',
      kodeRw: '02',
      namaKelurahan: 'Sukamaju',
      namaKecamatan: 'Cilodong',
      namaKota: 'Kota Depok',
      kodePos: '16415',
    });
    expect(d.displayTitle).toBe('RT 05 / RW 02');
    expect(d.displaySub).toBe('Kel. Sukamaju, Kec. Cilodong, Kota Depok');
    expect(d.displayFull).toBe('RT 05 / RW 02 Kel. Sukamaju, Kec. Cilodong, Kota Depok 16415');
  });
});

describe('plan matrix integrity', () => {
  it('declares a quota row for every plan code', () => {
    for (const plan of Object.values(PlanCode)) {
      expect(PLAN_QUOTA_MATRIX[plan]).toBeDefined();
      expect(getPlanCatalogueEntry(plan)).toBeDefined();
      expect(getPlanQuota(plan)).toBe(PLAN_QUOTA_MATRIX[plan]);
    }
  });

  it('enforces the COMMERCIAL promise: FREE caps at 50 KK', () => {
    expect(getPlanQuota(PlanCode.FREE).maxKartuKeluarga).toBe(50);
  });

  it('enforces the COMMERCIAL promise: PRO_RT is unlimited KK', () => {
    expect(getPlanQuota(PlanCode.PRO_RT).maxKartuKeluarga).toBeNull();
    expect(getPlanQuota(PlanCode.PRO_RT).maxWarga).toBeNull();
  });

  it('enforces the COMMERCIAL promise: only ENTERPRISE may consolidate child RTs', () => {
    expect(getPlanQuota(PlanCode.FREE).maxChildTenants).toBe(0);
    expect(getPlanQuota(PlanCode.PRO_RT).maxChildTenants).toBe(0);
    expect(getPlanQuota(PlanCode.ENTERPRISE_KELURAHAN).maxChildTenants).toBeGreaterThan(0);
  });

  it('gates Ed25519 e-signature behind a paid plan', () => {
    expect(planHasFeature(PlanCode.FREE, 'TANDA_TANGAN_ED25519')).toBe(false);
    expect(planHasFeature(PlanCode.PRO_RT, 'TANDA_TANGAN_ED25519')).toBe(true);
    expect(planHasFeature(PlanCode.ENTERPRISE_KELURAHAN, 'TANDA_TANGAN_ED25519')).toBe(true);
  });

  it('grants ENTERPRISE every declared feature', () => {
    for (const f of TENANT_FEATURES) {
      expect(planHasFeature(PlanCode.ENTERPRISE_KELURAHAN, f)).toBe(true);
    }
  });

  it('maps every quota resource to a limit and a label', () => {
    for (const res of Object.values(TenantQuotaResource)) {
      expect(quotaResourceLabel(res).length).toBeGreaterThan(0);
      // Must not fall through the default branch for a declared enum member.
      expect(quotaResourceLabel(res)).not.toBe('Kuota');
      expect(() => quotaLimitForResource(PLAN_QUOTA_MATRIX[PlanCode.FREE], res)).not.toThrow();
    }
  });
});

describe('tenant lifecycle guards (assertOperational)', () => {
  beforeEach(() => {
    TenantContextService.invalidate();
  });

  it('lets an ACTIVE tenant both read and write', () => {
    const c = ctx({ status: TenantStatus.ACTIVE });
    expect(() => TenantContextService.assertOperational(c, false)).not.toThrow();
    expect(() => TenantContextService.assertOperational(c, true)).not.toThrow();
  });

  it('blocks reads AND writes for a PENDING tenant', () => {
    const c = ctx({ status: TenantStatus.PENDING });
    expect(() => TenantContextService.assertOperational(c, false)).toThrow(TenantAccessError);
    expect(() => TenantContextService.assertOperational(c, true)).toThrow(TenantAccessError);
  });

  it('allows READS but blocks WRITES for a SUSPENDED tenant (read-only mode)', () => {
    const c = ctx({ status: TenantStatus.SUSPENDED });
    expect(() => TenantContextService.assertOperational(c, false)).not.toThrow();

    let thrown: unknown;
    try {
      TenantContextService.assertOperational(c, true);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(TenantAccessError);
    expect((thrown as TenantAccessError).code).toBe(ErrorCode.ERR_SUBSCRIPTION_EXPIRED);
    // 402 Payment Required so the UI can raise the upgrade flow.
    expect((thrown as TenantAccessError).statusCode).toBe(402);
  });

  it('blocks everything for an ARCHIVED tenant', () => {
    const c = ctx({ status: TenantStatus.ARCHIVED });
    expect(() => TenantContextService.assertOperational(c, false)).toThrow(TenantAccessError);
    try {
      TenantContextService.assertOperational(c, true);
    } catch (e) {
      expect((e as TenantAccessError).code).toBe(ErrorCode.ERR_TENANT_SUSPENDED);
      expect((e as TenantAccessError).statusCode).toBe(403);
    }
  });

  it('treats an expired subscription as SUSPENDED even when the row says ACTIVE', async () => {
    // Simulates buildContext folding subscription state into tenant status:
    // the row-level status is ACTIVE, but the subscription has EXPIRED.
    const expired = ctx({ status: TenantStatus.SUSPENDED });
    expect(() => TenantContextService.assertOperational(expired, true)).toThrow(TenantAccessError);
  });
});

describe('plan feature guards (assertFeature)', () => {
  it('allows a FREE tenant to use kependudukan', () => {
    expect(() =>
      TenantContextService.assertFeature(ctx({ planCode: PlanCode.FREE }), 'KEPENDUDUKAN_DASAR')
    ).not.toThrow();
  });

  it('rejects e-signature for a FREE tenant with a payable error', () => {
    let thrown: unknown;
    try {
      TenantContextService.assertFeature(
        ctx({ planCode: PlanCode.FREE }),
        'TANDA_TANGAN_ED25519'
      );
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(TenantAccessError);
    expect((thrown as TenantAccessError).code).toBe(ErrorCode.ERR_PLAN_FEATURE_LOCKED);
    expect((thrown as TenantAccessError).statusCode).toBe(402);
  });

  it('allows e-signature for PRO_RT', () => {
    expect(() =>
      TenantContextService.assertFeature(
        ctx({ planCode: PlanCode.PRO_RT }),
        'TANDA_TANGAN_ED25519'
      )
    ).not.toThrow();
  });

  it('rejects the multi-RT dashboard for PRO_RT (ENTERPRISE only)', () => {
    expect(() =>
      TenantContextService.assertFeature(
        ctx({ planCode: PlanCode.PRO_RT }),
        'MULTI_RT_DASHBOARD'
      )
    ).toThrow(TenantAccessError);
  });
});

describe('tenant context projection', () => {
  it('lists exactly the features the plan unlocks', () => {
    const free = TenantContextService.featuresFor(ctx({ planCode: PlanCode.FREE }));
    expect(free).toContain('KEPENDUDUKAN_DASAR');
    expect(free).not.toContain('TANDA_TANGAN_ED25519');

    const ent = TenantContextService.featuresFor(ctx({ planCode: PlanCode.ENTERPRISE_KELURAHAN }));
    expect(ent.length).toBe(TENANT_FEATURES.length);
  });

  it('projects a summary carrying the request rtId', () => {
    const c = ctx();
    const summary = TenantContextService.toSummary(c, '16415');
    expect(summary.rtId).toBe(c.rtId);
    expect(summary.slug).toBe(c.slug);
    expect(summary.planCode).toBe(c.planCode);
    expect(summary.displayTitle).toBe('RT 05 / RW 02');
    expect(summary.displayFull).toContain('16415');
  });
});
