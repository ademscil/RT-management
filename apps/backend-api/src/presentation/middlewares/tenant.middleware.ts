import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  ErrorCode,
  TENANT_HEADER,
  TenantResolutionSource,
  UserRole,
  type TenantContext,
  type TenantFeature,
} from '@simrt/shared-types';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  TenantAccessError,
  TenantContextService,
} from '../../infrastructure/tenant/tenant-context.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Request-scoped tenant context. Set by `resolveTenantContext`. */
    tenantContext?: TenantContext;
  }
}

/** True when the caller holds unrestricted cross-tenant authority. */
function isSuperuser(request: FastifyRequest): boolean {
  const role = request.userSession?.role as string | undefined;
  return role === UserRole.SUPERUSER || role === 'SUPERADMIN';
}

function sendError(reply: FastifyReply, status: number, code: ErrorCode, message: string): void {
  reply.status(status).send({
    success: false,
    error: { code, message },
    timestamp: new Date().toISOString(),
  });
}

/**
 * ==============================================================================
 * TENANT RESOLUTION — the isolation gate
 * ==============================================================================
 * MUST run after `authenticateJwt`.
 *
 * Resolution rules, in order:
 *   1. `x-rt-id` header present AND caller is SUPERUSER → honour it.
 *   2. `x-rt-id` header present AND differs from the JWT claim → HTTP 403.
 *      A non-superuser can NEVER read another tenant by setting a header.
 *   3. Otherwise → the signed JWT `rtId` claim is authoritative.
 *
 * A claim that does not resolve to a live tenant is rejected with 401 rather
 * than silently falling back to a default tenant — that fallback shape was
 * exactly the original cross-tenant leak.
 */
export async function resolveTenantContext(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const session = request.userSession;
  if (!session) {
    sendError(
      reply,
      401,
      ErrorCode.ERR_UNAUTHORIZED,
      'Autentikasi diperlukan sebelum konteks komunitas RT dapat ditentukan.'
    );
    return;
  }

  const rawHeader = request.headers[TENANT_HEADER];
  const assertedRtId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

  let rtId: string;
  let source: TenantResolutionSource;

  if (assertedRtId && assertedRtId.trim()) {
    if (isSuperuser(request)) {
      rtId = assertedRtId.trim();
      source = TenantResolutionSource.SUPERUSER_HEADER;
    } else if (assertedRtId.trim() === session.rtId) {
      rtId = session.rtId;
      source = TenantResolutionSource.JWT_CLAIM;
    } else {
      // Cross-tenant read attempt by a non-superuser. Reject loudly.
      sendError(
        reply,
        403,
        ErrorCode.ERR_TENANT_MISMATCH,
        'Anda tidak memiliki wewenang untuk mengakses data komunitas RT lain.'
      );
      return;
    }
  } else {
    if (!session.rtId) {
      sendError(
        reply,
        401,
        ErrorCode.ERR_TENANT_REQUIRED,
        'Sesi Anda tidak memiliki konteks komunitas RT. Silakan login kembali.'
      );
      return;
    }
    rtId = session.rtId;
    source = TenantResolutionSource.JWT_CLAIM;
  }

  const prisma = PrismaService.getInstance();
  const ctx = await TenantContextService.resolve(prisma, rtId, source);

  if (!ctx) {
    sendError(
      reply,
      401,
      ErrorCode.ERR_TENANT_REQUIRED,
      'Komunitas RT pada sesi Anda tidak ditemukan atau telah dihapus. Silakan login kembali.'
    );
    return;
  }

  request.tenantContext = ctx;
}

/**
 * Guard: reject mutating requests for tenants in a read-only lifecycle state.
 * Apply to POST/PUT/PATCH/DELETE handlers.
 */
export async function requireActiveTenant(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ctx = request.tenantContext;
  if (!ctx) {
    sendError(reply, 401, ErrorCode.ERR_TENANT_REQUIRED, 'Konteks komunitas RT belum ditentukan.');
    return;
  }
  try {
    TenantContextService.assertOperational(ctx, true);
  } catch (err) {
    if (err instanceof TenantAccessError) {
      sendError(reply, err.statusCode, err.code, err.message);
      return;
    }
    throw err;
  }
}

/**
 * Guard factory: require the tenant's plan to unlock a feature.
 * Usage: `{ preHandler: [authenticateJwt, resolveTenantContext, requirePlanFeature('TANDA_TANGAN_ED25519')] }`
 */
export function requirePlanFeature(feature: TenantFeature) {
  return async function planFeatureGuard(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const ctx = request.tenantContext;
    if (!ctx) {
      sendError(reply, 401, ErrorCode.ERR_TENANT_REQUIRED, 'Konteks komunitas RT belum ditentukan.');
      return;
    }
    try {
      TenantContextService.assertFeature(ctx, feature);
    } catch (err) {
      if (err instanceof TenantAccessError) {
        sendError(reply, err.statusCode, err.code, err.message);
        return;
      }
      throw err;
    }
  };
}

/**
 * Read the mandatory tenant context off a request.
 * Throws when the guard chain was misconfigured — a programming error, never
 * something an external caller can trigger.
 */
export function getTenantContext(request: FastifyRequest): TenantContext {
  const ctx = request.tenantContext;
  if (!ctx) {
    throw new Error(
      '[tenant] getTenantContext() called without resolveTenantContext in the preHandler chain.'
    );
  }
  return ctx;
}

/** Canonical tenant id for the current request. */
export function getRtId(request: FastifyRequest): string {
  return getTenantContext(request).rtId;
}

/**
 * Build a Prisma `where` fragment pinned to the request's tenant.
 * Merge with extra filters: `{ ...tenantFilter(request), status: 'PAID' }`
 */
export function tenantFilter<T extends Record<string, unknown>>(
  request: FastifyRequest,
  extra?: T
): { rtId: string } & T {
  return { rtId: getRtId(request), ...((extra ?? {}) as T) };
}

/** True when the current request is scoped as a SUPERUSER. */
export function isSuperuserRequest(request: FastifyRequest): boolean {
  return isSuperuser(request);
}
