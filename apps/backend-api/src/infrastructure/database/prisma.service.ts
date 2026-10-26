import { createRequire } from 'node:module';
import type { PrismaClient as PrismaClientType } from '@prisma/client';

const getPrismaClient = (): (new (opts?: unknown) => PrismaClientType) => {
  try {
    if (typeof require !== 'undefined') {
      return require('@prisma/client').PrismaClient;
    }
    const req = createRequire(import.meta.url);
    return req('@prisma/client').PrismaClient;
  } catch {
    // Only reachable when @prisma/client has not been generated yet.
    throw new Error(
      '[PrismaService] @prisma/client is not generated. Run `pnpm db:generate` before starting the API.'
    );
  }
};

/**
 * Structured tenant scope passed into `withTenantContext`.
 * Mirrors the PostgreSQL session variables consumed by the RLS policies in
 * `docker/postgres-init/01-init-rls.sql`.
 */
export interface RlsTenantScope {
  /** Canonical tenant id — `RukunTetanggaConfig.id`. REQUIRED for isolation. */
  rtId: string;
  userId?: string | null;
  role?: string | null;
  /** Kartu Keluarga id of the authenticated resident (resident-scoped rows). */
  kkId?: string | null;
}

export class PrismaService {
  private static instance: PrismaClientType | undefined;

  /**
   * Typed Prisma accessor.
   *
   * This is deliberately typed as `PrismaClient` (NOT `any`). Typing it as `any`
   * erased every schema-level guarantee, so the compiler could not detect a
   * missing `rtId` on a tenant-scoped write — a silent cross-tenant leak vector.
   * The concrete type makes `tsc` a compile-time fortress for tenant isolation.
   */
  public static getInstance(): PrismaClientType {
    if (!PrismaService.instance) {
      const PrismaClient = getPrismaClient();
      PrismaService.instance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      });
    }
    return PrismaService.instance;
  }

  /**
   * Execute a unit of work inside a PostgreSQL session carrying tenant context.
   *
   * SECURITY: session variables are bound with `set_config(name, value, true)`
   * using real query parameters. The previous implementation interpolated values
   * straight into `SET LOCAL ... = '${value}'`, a SQL-injection sink reachable
   * from any attacker-influenced string that reached the context.
   *
   * The `true` third argument scopes the setting to the CURRENT TRANSACTION, so
   * it can never leak to another request through a pooled connection.
   */
  public static async withTenantContext<T>(
    scope: RlsTenantScope,
    fn: (tx: PrismaClientType) => Promise<T>
  ): Promise<T> {
    const prisma = PrismaService.getInstance();

    if (!scope.rtId) {
      throw new Error('[PrismaService] Refusing to open a tenant transaction without an rtId.');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Tenant id — the anchor every RLS policy checks.
      await tx.$executeRaw`SELECT set_config('app.current_rt_id', ${scope.rtId}, true)`;

      // 2. Optional actor context.
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${scope.userId ?? ''}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_role', ${scope.role ?? 'WARGA'}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_kk_id', ${scope.kkId ?? ''}, true)`;

      return await fn(tx as unknown as PrismaClientType);
    });
  }

  /**
   * @deprecated Use {@link withTenantContext}. Retained so existing callers keep
   * working during migration; delegates to the tenant-aware implementation and
   * refuses to run without an `rtId`.
   */
  public static async withRlsContext<T>(
    context: { rtId?: string; userId?: string; role?: string; kkId?: string },
    fn: (tx: PrismaClientType) => Promise<T>
  ): Promise<T> {
    if (!context.rtId) {
      throw new Error(
        '[PrismaService] withRlsContext() requires an rtId. Callers must resolve the tenant from the authenticated session.'
      );
    }
    return PrismaService.withTenantContext(
      {
        rtId: context.rtId,
        userId: context.userId ?? null,
        role: context.role ?? null,
        kkId: context.kkId ?? null,
      },
      fn
    );
  }

  /** Graceful shutdown hook (Vercel serverless + container both benefit). */
  public static async disconnect(): Promise<void> {
    if (PrismaService.instance) {
      await PrismaService.instance.$disconnect();
      PrismaService.instance = undefined;
    }
  }
}
