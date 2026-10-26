import {
  ErrorCode,
  PlanCode,
  TENANT_FEATURES,
  TenantResolutionSource,
  TenantStatus,
  type TenantContext,
  type TenantFeature,
  type TenantSummary,
  buildTenantDisplay,
  getPlanQuota,
  planHasFeature,
} from '@simrt/shared-types';
import type { PrismaClient } from '@prisma/client';

/** Minimal shape of a tenant row read from `rukun_tetangga_config`. */
export interface TenantRow {
  id: string;
  slug: string;
  kodeRt: string;
  kodeRw: string;
  namaKelurahan: string;
  namaKecamatan: string;
  namaKota: string;
  kodePos: string;
  status: string;
  planCode: string;
  subscription?: { status: string; endsAt: Date | null; gracePeriodEndsAt: Date | null } | null;
}

/** Error carrying an HTTP status + machine-readable ErrorCode for handlers. */
export class TenantAccessError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, statusCode = 403) {
    super(message);
    this.name = 'TenantAccessError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class TenantContextService {
  private static readonly CACHE_TTL_MS = 15_000;
  private static cache = new Map<string, { ctx: TenantContext; expiresAt: number }>();

  /** Test seam — clears the tenant resolution cache. */
  public static invalidate(rtId?: string): void {
    if (rtId) this.cache.delete(rtId);
    else this.cache.clear();
  }

  /**
   * Resolve a tenant by canonical id and bind it to a request context.
   * Returns `null` when the tenant does not exist — the caller decides whether
   * that is a 404 (explicit lookup) or a 401 (forged JWT claim).
   */
  public static async resolve(
    prisma: PrismaClient,
    rtId: string,
    source: TenantResolutionSource
  ): Promise<TenantContext | null> {
    const cached = this.cache.get(rtId);
    if (cached && cached.expiresAt > Date.now()) {
      // Resolution source is per-request, not per-tenant — re-stamp it.
      return { ...cached.ctx, resolutionSource: source };
    }

    const row = (await prisma.rukunTetanggaConfig.findUnique({
      where: { id: rtId },
      include: {
        subscription: { select: { status: true, endsAt: true, gracePeriodEndsAt: true } },
      },
    })) as TenantRow | null;

    if (!row) {
      this.cache.delete(rtId);
      return null;
    }

    const ctx = this.buildContext(row, source);
    this.cache.set(rtId, { ctx, expiresAt: Date.now() + this.CACHE_TTL_MS });
    return ctx;
  }

  /** Resolve a tenant by its globally unique slug. */
  public static async resolveBySlug(
    prisma: PrismaClient,
    slug: string,
    source: TenantResolutionSource
  ): Promise<TenantContext | null> {
    const row = (await prisma.rukunTetanggaConfig.findUnique({
      where: { slug: slug.trim().toLowerCase() },
      include: {
        subscription: { select: { status: true, endsAt: true, gracePeriodEndsAt: true } },
      },
    })) as TenantRow | null;

    if (!row) return null;
    return this.buildContext(row, source);
  }

  /**
   * Resolve the default active tenant for unauthenticated routes.
   * Deterministic (oldest ACTIVE tenant wins) so public endpoints stay stable.
   */
  public static async resolveDefaultActive(
    prisma: PrismaClient,
    source: TenantResolutionSource = TenantResolutionSource.PUBLIC_DEFAULT
  ): Promise<TenantContext | null> {
    const row = (await prisma.rukunTetanggaConfig.findFirst({
      where: { status: TenantStatus.ACTIVE },
      orderBy: { createdAt: 'asc' },
      include: {
        subscription: { select: { status: true, endsAt: true, gracePeriodEndsAt: true } },
      },
    })) as TenantRow | null;

    if (!row) return null;
    return this.buildContext(row, source);
  }

  /**
   * Build the immutable request-scoped context from a DB row. Subscription
   * status is folded in so callers receive one authoritative verdict.
   */
  private static buildContext(row: TenantRow, source: TenantResolutionSource): TenantContext {
    const status = this.normalizeStatus(row.status);
    const planCode = this.normalizePlanCode(row.planCode);
    const sub = row.subscription ?? null;

    const endsAt = sub?.endsAt ?? null;
    const isTrialing = sub?.status === 'TRIALING';

    // A tenant whose paid term elapsed is READ-ONLY while inside grace.
    let effectiveStatus = status;
    if (sub && sub.status === 'EXPIRED' && status === TenantStatus.ACTIVE) {
      effectiveStatus = TenantStatus.SUSPENDED;
    }

    return {
      rtId: row.id,
      slug: row.slug,
      kodeRt: row.kodeRt,
      kodeRw: row.kodeRw,
      namaKelurahan: row.namaKelurahan,
      namaKecamatan: row.namaKecamatan,
      namaKota: row.namaKota,
      status: effectiveStatus,
      planCode,
      isTrialing,
      subscriptionEndsAt: endsAt ? endsAt.toISOString() : null,
      resolutionSource: source,
    };
  }

  private static normalizeStatus(raw: string): TenantStatus {
    return (Object.values(TenantStatus) as string[]).includes(raw)
      ? (raw as TenantStatus)
      : TenantStatus.ACTIVE;
  }

  private static normalizePlanCode(raw: string): PlanCode {
    return (Object.values(PlanCode) as string[]).includes(raw) ? (raw as PlanCode) : PlanCode.FREE;
  }

  /**
   * Guard that the tenant may serve this request.
   *
   * @param mutating when true, READ-ONLY states (SUSPENDED/PENDING/ARCHIVED)
   *                 are rejected with HTTP 402 so the UI can raise an upgrade flow.
   */
  public static assertOperational(ctx: TenantContext, mutating = false): void {
    if (ctx.status === TenantStatus.ACTIVE) return;

    if (ctx.status === TenantStatus.PENDING) {
      throw new TenantAccessError(
        ErrorCode.ERR_TENANT_SUSPENDED,
        'Komunitas RT ini belum aktif. Selesaikan aktivasi langganan terlebih dahulu.',
        402
      );
    }

    if (ctx.status === TenantStatus.SUSPENDED) {
      if (mutating) {
        throw new TenantAccessError(
          ErrorCode.ERR_SUBSCRIPTION_EXPIRED,
          'Masa langganan telah berakhir. Sistem dalam mode baca-saja — perbarui langganan untuk menambah data.',
          402
        );
      }
      return;
    }

    if (ctx.status === TenantStatus.ARCHIVED) {
      throw new TenantAccessError(
        ErrorCode.ERR_TENANT_SUSPENDED,
        'Komunitas RT ini telah dinonaktifkan secara permanen.',
        403
      );
    }
  }

  /** Guard that the tenant's plan unlocks a feature. */
  public static assertFeature(ctx: TenantContext, feature: TenantFeature): void {
    if (!planHasFeature(ctx.planCode, feature)) {
      throw new TenantAccessError(
        ErrorCode.ERR_PLAN_FEATURE_LOCKED,
        `Fitur ini tidak termasuk dalam paket ${ctx.planCode}. Silakan tingkatkan paket langganan Anda.`,
        402
      );
    }
  }

  /** Project a context into the shape the UI consumes for tenant switching. */
  public static toSummary(ctx: TenantContext, kodePos = ''): TenantSummary {
    return {
      rtId: ctx.rtId,
      slug: ctx.slug,
      kodeRt: ctx.kodeRt,
      kodeRw: ctx.kodeRw,
      namaKelurahan: ctx.namaKelurahan,
      namaKecamatan: ctx.namaKecamatan,
      namaKota: ctx.namaKota,
      status: ctx.status,
      planCode: ctx.planCode,
      ...buildTenantDisplay({
        kodeRt: ctx.kodeRt,
        kodeRw: ctx.kodeRw,
        namaKelurahan: ctx.namaKelurahan,
        namaKecamatan: ctx.namaKecamatan,
        namaKota: ctx.namaKota,
        ...(kodePos ? { kodePos } : {}),
      }),
    };
  }

  /** All features unlocked by the tenant's current plan. */
  public static featuresFor(ctx: TenantContext): readonly TenantFeature[] {
    return TENANT_FEATURES.filter((f) => planHasFeature(ctx.planCode, f));
  }

  /** Quota definition for the tenant's current plan. */
  public static quotaFor(ctx: TenantContext) {
    return getPlanQuota(ctx.planCode);
  }
}
