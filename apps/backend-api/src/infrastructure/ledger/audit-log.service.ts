import { HashChainService } from './hash-chain.service.js';
import type { PrismaClient } from '@prisma/client';

export interface AuditLogInput {
  rtId: string;
  actorUserId: string;
  actorRole: string;
  actionType: string;
  targetEntity: string;
  targetId: string;
  accessReason?: string | null;
  ipAddress: string;
  userAgent: string;
}

export interface AuditLogRecord {
  id: string;
  rtId: string;
  sequence: number;
  prevHash: string;
  rowHash: string;
  createdAt: Date;
}

/** Prisma error code for a transaction write conflict / serialization failure. */
const WRITE_CONFLICT = 'P2034';
const MAX_ATTEMPTS = 5;

/**
 * ==============================================================================
 * PER-TENANT TAMPER-EVIDENT AUDIT TRAIL
 * ==============================================================================
 * Every audit row joins a SHA-256 hash chain that is scoped to ONE tenant:
 *
 *   rowHash = SHA256(prevHash : id : actorId : "ACTION:targetId" : timestamp)
 *
 * Two guarantees this service provides that the previous inline implementations
 * did not:
 *
 *  1. TENANT ISOLATION — both `prevHash` lookup and the stored `rtId` are pinned
 *     to a single tenant, so one RT appending a row can no longer invalidate
 *     (or be mistaken for) another RT's chain.
 *
 *  2. CHAIN INTEGRITY UNDER CONCURRENCY — `sequence` and `prevHash` are read and
 *     written inside one SERIALIZABLE transaction with bounded retry. Reading
 *     `prevHash` outside a transaction (the old behaviour) let two concurrent
 *     writers fork the chain and permanently break verification.
 */
export class AuditLogService {
  private static readonly chain = new HashChainService();

  /**
   * Canonical hash payload. Used by BOTH append and verify so the two can never
   * drift. `accessReason` is included deliberately: storing a justification
   * outside the hash would let it be altered without breaking the chain.
   */
  private static hashPayload(actionType: string, targetId: string, accessReason: string): string {
    return `${actionType}:${targetId}:${accessReason}`;
  }

  /**
   * Append one row to a tenant's audit chain.
   * Returns the persisted record. Throws only if every retry is exhausted.
   */
  public static async append(
    prisma: PrismaClient,
    input: AuditLogInput
  ): Promise<AuditLogRecord> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await prisma.$transaction(
          async (tx) => {
            const last = await tx.securityAuditLog.findFirst({
              where: { rtId: input.rtId },
              orderBy: { sequence: 'desc' },
              select: { sequence: true, rowHash: true },
            });

            const sequence = (last?.sequence ?? 0) + 1;
            const prevHash = last?.rowHash ?? HashChainService.GENESIS_HASH;
            const id = `AUD-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
            const recordedAt = new Date();
            const timestampIso = recordedAt.toISOString();
            const accessReason = input.accessReason ?? '';

            const rowHash = AuditLogService.chain.computeRowHash(
              prevHash,
              id,
              input.actorUserId,
              AuditLogService.hashPayload(input.actionType, input.targetId, accessReason),
              timestampIso
            );

            // `createdAt` is written EXPLICITLY so the persisted timestamp is
            // byte-identical to the one hashed above. Relying on
            // `@default(now())` would make `verifyTenantChain()` — which recomputes
            // from `created_at` — flag every row as tampered.
            const created = await tx.securityAuditLog.create({
              data: {
                id,
                rtId: input.rtId,
                sequence,
                actorUserId: input.actorUserId,
                actorRole: input.actorRole,
                actionType: input.actionType,
                targetEntity: input.targetEntity,
                targetId: input.targetId,
                accessReason: accessReason || null,
                ipAddress: input.ipAddress,
                userAgent: input.userAgent,
                prevHash,
                rowHash,
                createdAt: recordedAt,
              },
              select: {
                id: true,
                rtId: true,
                sequence: true,
                prevHash: true,
                rowHash: true,
                createdAt: true,
              },
            });

            return created as AuditLogRecord;
          },
          { isolationLevel: 'Serializable' }
        );
      } catch (err: unknown) {
        lastError = err;
        const code = (err as { code?: string } | null)?.code;
        if (code !== WRITE_CONFLICT) throw err;
        // Jittered backoff keeps retrying writers from colliding again.
        await new Promise((r) => setTimeout(r, 10 * attempt + Math.floor(Math.random() * 20)));
      }
    }

    throw lastError;
  }

  /**
   * Append an audit row without ever failing the caller's business operation.
   * Use for non-critical trails (config updates, house creation) where the
   * audit record must not block the primary write.
   */
  public static async appendBestEffort(prisma: PrismaClient, input: AuditLogInput): Promise<void> {
    try {
      await AuditLogService.append(prisma, input);
    } catch {
      // Swallowed by design — callers that need a guaranteed trail must call
      // `append` directly and surface the error.
    }
  }

  /** Recompute a tenant's chain and report the first tampered position. */
  public static async verifyTenantChain(
    prisma: PrismaClient,
    rtId: string
  ): Promise<ReturnType<HashChainService['verifyChain']>> {
    const rows = await prisma.securityAuditLog.findMany({
      where: { rtId },
      orderBy: { sequence: 'asc' },
      select: {
        id: true,
        actorUserId: true,
        actionType: true,
        targetId: true,
        accessReason: true,
        prevHash: true,
        rowHash: true,
        createdAt: true,
      },
    });

    const records = rows.map((r) => ({
      id: r.id,
      actorId: r.actorUserId,
      actionOrNominal: AuditLogService.hashPayload(
        r.actionType,
        r.targetId,
        r.accessReason ?? ''
      ),
      timestampIso: r.createdAt.toISOString(),
      prevHash: r.prevHash,
      rowHash: r.rowHash,
    }));

    return AuditLogService.chain.verifyChain(records);
  }
}
