import {
  ErrorCode,
  TENANT_ADMIN_ROLES,
  TenantQuotaResource,
  getPlanQuota,
  quotaLimitForResource,
  quotaResourceLabel,
  type TenantContext,
  type TenantUsageSnapshot,
} from '@simrt/shared-types';
import type { PrismaClient } from '@prisma/client';
import { TenantAccessError } from './tenant-context.service.js';

const BYTES_PER_MB = 1024 * 1024;

/** Roles counted against the `maxAdminUsers` quota (i.e. non-resident roles). */
const ADMIN_ROLE_STRINGS: string[] = TENANT_ADMIN_ROLES.map((r) => r as string);

export interface QuotaUsageCounts {
  totalKartuKeluarga: number;
  totalWarga: number;
  totalAdminUsers: number;
  storageUsedMb: number;
}

/**
 * Plan quota accounting and enforcement.
 *
 * Every mutating route that grows a billable resource MUST call
 * `assertAvailable` BEFORE the write, inside the same transaction where
 * possible. Counting is tenant-scoped so one RT can never exhaust another's
 * quota.
 */
export class PlanQuotaService {
  /** Read the live consumption counts for one tenant. */
  public static async counts(prisma: PrismaClient, rtId: string): Promise<QuotaUsageCounts> {
    const [totalKartuKeluarga, totalWarga, totalAdminUsers, storageAgg] = await Promise.all([
      prisma.kartuKeluarga.count({ where: { rtId } }),
      prisma.warga.count({ where: { rtId } }),
      prisma.user.count({ where: { rtId, role: { in: ADMIN_ROLE_STRINGS } } }),
      prisma.dokumenVault.aggregate({ where: { rtId }, _sum: { sizeBytes: true } }),
    ]);

    const usedBytes = Number(storageAgg._sum.sizeBytes ?? 0);

    return {
      totalKartuKeluarga,
      totalWarga,
      totalAdminUsers,
      storageUsedMb: Math.ceil(usedBytes / BYTES_PER_MB),
    };
  }

  /** Build the quota meter payload the admin panel renders. */
  public static async snapshot(prisma: PrismaClient, ctx: TenantContext): Promise<TenantUsageSnapshot> {
    const counts = await this.counts(prisma, ctx.rtId);
    const quota = getPlanQuota(ctx.planCode);

    const exceeded = (used: number, limit: number | null): boolean =>
      limit !== null && used >= limit;

    return {
      ...counts,
      quota,
      isKartuKeluargaQuotaExceeded: exceeded(counts.totalKartuKeluarga, quota.maxKartuKeluarga),
      isWargaQuotaExceeded: exceeded(counts.totalWarga, quota.maxWarga),
      isStorageQuotaExceeded: exceeded(counts.storageUsedMb, quota.maxStorageMb),
    };
  }

  /**
   * Assert that `delta` additional units of `resource` fit inside the plan.
   * Throws a 402 `ERR_QUOTA_EXCEEDED` carrying the upgrade hint.
   */
  public static async assertAvailable(
    prisma: PrismaClient,
    ctx: TenantContext,
    resource: TenantQuotaResource,
    delta = 1
  ): Promise<void> {
    const quota = getPlanQuota(ctx.planCode);
    const limit = quotaLimitForResource(quota, resource);

    // `null` limit means unlimited.
    if (limit === null) return;

    const counts = await this.counts(prisma, ctx.rtId);
    const used = this.readUsage(counts, resource);

    if (used + delta > limit) {
      const label = quotaResourceLabel(resource);
      throw new TenantAccessError(
        ErrorCode.ERR_QUOTA_EXCEEDED,
        `Kuota ${label} untuk paket ${ctx.planCode} telah tercapai (${used}/${limit}). Tingkatkan paket langganan untuk melanjutkan.`,
        402
      );
    }
  }

  /** Map a quota resource to its current consumption value. */
  private static readUsage(counts: QuotaUsageCounts, resource: TenantQuotaResource): number {
    switch (resource) {
      case TenantQuotaResource.KARTU_KELUARGA:
        return counts.totalKartuKeluarga;
      case TenantQuotaResource.WARGA:
        return counts.totalWarga;
      case TenantQuotaResource.ADMIN_USERS:
        return counts.totalAdminUsers;
      case TenantQuotaResource.STORAGE:
        return counts.storageUsedMb;
      default:
        return 0;
    }
  }

  /** Convert a byte count into the MB figure used by the storage quota. */
  public static toMb(bytes: number): number {
    return Math.ceil(bytes / BYTES_PER_MB);
  }

  /** Remaining headroom for a resource, or `null` when unlimited. */
  public static async remaining(
    prisma: PrismaClient,
    ctx: TenantContext,
    resource: TenantQuotaResource
  ): Promise<number | null> {
    const limit = quotaLimitForResource(getPlanQuota(ctx.planCode), resource);
    if (limit === null) return null;
    const counts = await this.counts(prisma, ctx.rtId);
    return Math.max(0, limit - this.readUsage(counts, resource));
  }
}
