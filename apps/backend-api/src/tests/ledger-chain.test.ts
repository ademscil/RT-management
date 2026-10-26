import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerService } from '../infrastructure/ledger/ledger.service.js';
import { AuditLogService } from '../infrastructure/ledger/audit-log.service.js';
import { HashChainService } from '../infrastructure/ledger/hash-chain.service.js';
import type { PrismaClient } from '@prisma/client';

/**
 * ==============================================================================
 * IN-MEMORY PRISMA DOUBLE
 * ==============================================================================
 * Purpose-built so these tests run with NO PostgreSQL. It implements only the
 * query surface `LedgerService` / `AuditLogService` actually touch, and models
 * the two behaviours that matter for chain integrity:
 *   * `findFirst` as a chain-head lookup (highest `sequence` for a tenant)
 *   * `$transaction(fn)` running the callback against the SAME store, so writes
 *     made inside the transaction are visible to it
 * ==============================================================================
 */

// Declared as type aliases (not `interface`) so TypeScript grants them an
// implicit index signature, making them assignable to `Record<string, unknown>`
// in the fake's projection helpers.
type PosRow = {
  id: string;
  rtId: string;
  kodePosKas: string;
  saldoBerjalan: bigint;
};

type KasRow = {
  id: string;
  rtId: string;
  sequence: number;
  posKeuanganId: string;
  tipe: string;
  nominal: bigint;
  saldoSetelah: bigint;
  deskripsi: string;
  buktiNotaMinioKey: string | null;
  createdByUserId: string;
  approvedByUserId: string | null;
  prevHash: string;
  rowHash: string;
  createdAt: Date;
};

type AuditRow = {
  id: string;
  rtId: string;
  sequence: number;
  actorUserId: string;
  actorRole: string;
  actionType: string;
  targetEntity: string;
  targetId: string;
  accessReason: string | null;
  ipAddress: string;
  userAgent: string;
  prevHash: string;
  rowHash: string;
  createdAt: Date;
};

class FakePrisma {
  public pos: PosRow[] = [];
  public kas: KasRow[] = [];
  public audit: AuditRow[] = [];

  private lastBySequence<T extends { sequence: number }>(rows: T[]): T | undefined {
    return [...rows].sort((a, b) => b.sequence - a.sequence)[0];
  }

  /**
   * Emulate Prisma's projection + DB-side defaults.
   *
   * Prisma applies `@default(now())` in the DATABASE and reads the value back via
   * RETURNING, so a real `create` always returns `createdAt` — and it honours the
   * caller's `select`. A fake that skips this produces rows missing `createdAt`,
   * which then makes `verifyTenantChain` blow up on `r.createdAt.toISOString()`.
   */
  private project(
    row: Record<string, unknown>,
    select?: Record<string, boolean>
  ): Record<string, unknown> {
    const materialised: Record<string, unknown> = { ...row };
    if (materialised.createdAt === undefined) materialised.createdAt = new Date();
    if (!select) return materialised;

    const out: Record<string, unknown> = {};
    for (const key of Object.keys(select)) {
      if (select[key]) out[key] = materialised[key];
    }
    return out;
  }

  /** Materialise DB-side defaults the way `RETURNING *` would. */
  private materialise(data: Record<string, unknown>): Record<string, unknown> {
    const row: Record<string, unknown> = { ...data };
    if (row.createdAt === undefined) row.createdAt = new Date();
    return row;
  }

  public readonly posKeuangan = {
    findFirst: async (args: { where: { id?: string; rtId?: string } }) => {
      const { id, rtId } = args.where;
      return (
        this.pos.find((p) => (id ? p.id === id : true) && (rtId ? p.rtId === rtId : true)) ?? null
      );
    },
    update: async (args: { where: { id: string }; data: { saldoBerjalan: bigint } }) => {
      const row = this.pos.find((p) => p.id === args.where.id);
      if (!row) throw new Error('pos not found');
      row.saldoBerjalan = args.data.saldoBerjalan;
      return row;
    },
  };

  public readonly kasLedgerImmutable = {
    findFirst: async (args: { where: { rtId: string }; select?: Record<string, boolean> }) => {
      const head = this.lastBySequence(this.kas.filter((k) => k.rtId === args.where.rtId));
      return head ? this.project(head, args.select) : null;
    },
    create: async (args: { data: Record<string, unknown>; select?: Record<string, boolean> }) => {
      // Persist the FULL row (as the database would); return only the projection,
      // exactly like Prisma's `select`.
      const full = this.materialise(args.data);
      this.kas.push(full as unknown as KasRow);
      return this.project(full, args.select);
    },
    findMany: async (args: { where: { rtId: string } }) =>
      this.kas.filter((k) => k.rtId === args.where.rtId).sort((a, b) => a.sequence - b.sequence),
  };

  public readonly securityAuditLog = {
    findFirst: async (args: { where: { rtId: string }; select?: Record<string, boolean> }) => {
      const head = this.lastBySequence(this.audit.filter((a) => a.rtId === args.where.rtId));
      return head ? this.project(head, args.select) : null;
    },
    create: async (args: { data: Record<string, unknown>; select?: Record<string, boolean> }) => {
      const full = this.materialise(args.data);
      this.audit.push(full as unknown as AuditRow);
      return this.project(full, args.select);
    },
    findMany: async (args: { where: { rtId: string } }) =>
      this.audit.filter((a) => a.rtId === args.where.rtId).sort((a, b) => a.sequence - b.sequence),
  };

  /** Runs the callback against this same store; the options arg is ignored. */
  public async $transaction<T>(fn: (tx: unknown) => Promise<T>, _opts?: unknown): Promise<T> {
    return fn(this);
  }
}

function asPrisma(fake: FakePrisma): PrismaClient {
  return fake as unknown as PrismaClient;
}

const RT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const POS_A = 'pos-a';
const POS_B = 'pos-b';

let fake: FakePrisma;

beforeEach(() => {
  fake = new FakePrisma();
  fake.pos.push(
    { id: POS_A, rtId: RT_A, kodePosKas: 'POS-OPS', saldoBerjalan: 0n },
    { id: POS_B, rtId: RT_B, kodePosKas: 'POS-OPS', saldoBerjalan: 0n }
  );
});

describe('LedgerService — per-tenant chain integrity', () => {
  it('anchors a tenant FIRST entry at GENESIS with sequence 1', async () => {
    const entry = await LedgerService.postEntry(asPrisma(fake), {
      rtId: RT_A,
      posKeuanganId: POS_A,
      tipe: 'IN',
      nominal: 50_000n,
      deskripsi: 'Iuran bulanan',
      createdByUserId: 'user-1',
    });

    expect(entry.sequence).toBe(1);
    expect(entry.prevHash).toBe(HashChainService.GENESIS_HASH);
    expect(entry.rowHash).toHaveLength(64);
    expect(entry.rowHash).not.toBe(HashChainService.GENESIS_HASH);
  });

  it('chains each entry onto the previous row of the SAME tenant', async () => {
    const first = await LedgerService.postEntry(asPrisma(fake), {
      rtId: RT_A,
      posKeuanganId: POS_A,
      tipe: 'IN',
      nominal: 50_000n,
      deskripsi: 'Iuran 1',
      createdByUserId: 'user-1',
    });
    const second = await LedgerService.postEntry(asPrisma(fake), {
      rtId: RT_A,
      posKeuanganId: POS_A,
      tipe: 'IN',
      nominal: 25_000n,
      deskripsi: 'Iuran 2',
      createdByUserId: 'user-1',
    });

    expect(second.sequence).toBe(2);
    expect(second.prevHash).toBe(first.rowHash);
  });

  it('ISOLATES tenants: RT B starts at GENESIS, not on RT A last hash', async () => {
    // Regression guard for the cross-tenant chain leak. The previous code read
    // the globally-latest ledger row, so RT B's first entry chained onto RT A's
    // hash and RT B could never verify its own ledger.
    await LedgerService.postEntry(asPrisma(fake), {
      rtId: RT_A,
      posKeuanganId: POS_A,
      tipe: 'IN',
      nominal: 10_000n,
      deskripsi: 'RT A entry',
      createdByUserId: 'user-a',
    });

    const bEntry = await LedgerService.postEntry(asPrisma(fake), {
      rtId: RT_B,
      posKeuanganId: POS_B,
      tipe: 'IN',
      nominal: 99_000n,
      deskripsi: 'RT B first entry',
      createdByUserId: 'user-b',
    });

    expect(bEntry.prevHash).toBe(HashChainService.GENESIS_HASH);
    expect(bEntry.sequence).toBe(1);
  });

  it('applies IN by adding and OUT by subtracting', async () => {
    await LedgerService.postEntry(asPrisma(fake), {
      rtId: RT_A,
      posKeuanganId: POS_A,
      tipe: 'IN',
      nominal: 100_000n,
      deskripsi: 'Masuk',
      createdByUserId: 'u',
    });
    const out = await LedgerService.postEntry(asPrisma(fake), {
      rtId: RT_A,
      posKeuanganId: POS_A,
      tipe: 'OUT',
      nominal: 40_000n,
      deskripsi: 'Keluar',
      createdByUserId: 'u',
    });

    expect(out.saldoSetelah).toBe(60_000n);
    expect(fake.pos.find((p) => p.id === POS_A)!.saldoBerjalan).toBe(60_000n);
  });

  it('refuses an OUT that exceeds the balance and writes nothing', async () => {
    await expect(
      LedgerService.postEntry(asPrisma(fake), {
        rtId: RT_A,
        posKeuanganId: POS_A,
        tipe: 'OUT',
        nominal: 1n,
        deskripsi: 'Overdraft',
        createdByUserId: 'u',
      })
    ).rejects.toThrow(/INSUFFICIENT_FUNDS/);

    expect(fake.kas).toHaveLength(0);
  });

  it('refuses to post against another tenant cash account', async () => {
    await expect(
      LedgerService.postEntry(asPrisma(fake), {
        rtId: RT_B,
        posKeuanganId: POS_A, // belongs to RT_A
        tipe: 'IN',
        nominal: 1n,
        deskripsi: 'Cross-tenant',
        createdByUserId: 'u',
      })
    ).rejects.toThrow(/not found for tenant/);
  });

  it('verifies a clean chain and DETECTS tampering', async () => {
    await LedgerService.postEntry(asPrisma(fake), {
      rtId: RT_A,
      posKeuanganId: POS_A,
      tipe: 'IN',
      nominal: 10_000n,
      deskripsi: 'a',
      createdByUserId: 'u',
    });
    await LedgerService.postEntry(asPrisma(fake), {
      rtId: RT_A,
      posKeuanganId: POS_A,
      tipe: 'IN',
      nominal: 20_000n,
      deskripsi: 'b',
      createdByUserId: 'u',
    });

    const clean = await LedgerService.verifyTenantChain(asPrisma(fake), RT_A);
    expect(clean.isChainValid).toBe(true);
    expect(clean.totalRecordsChecked).toBe(2);

    // Tamper with the recorded amount of the second row WITHOUT recomputing its
    // hash — exactly what an attacker editing the table directly would do.
    fake.kas[1].nominal = 999_999n;

    const tampered = await LedgerService.verifyTenantChain(asPrisma(fake), RT_A);
    expect(tampered.isChainValid).toBe(false);
    expect(tampered.tamperedRecordId).toBe(fake.kas[1].id);
  });

  it('persists the exact createdAt it hashed (regression: DB default breaks verification)', async () => {
    // THE BUG THIS GUARDS: if `createdAt` is left to the column default
    // (@default(now())), the persisted instant is microseconds-to-milliseconds
    // LATER than the one fed into computeRowHash. verifyTenantChain() recomputes
    // the hash from `created_at`, so EVERY entry would be reported as tampered and
    // the immutable ledger/audit trail would be permanently unverifiable.
    //
    // This test reconstructs the row hash using ONLY what was persisted. If the
    // service forgot to write `createdAt` explicitly, it fails.
    const entry = await LedgerService.postEntry(asPrisma(fake), {
      rtId: RT_A,
      posKeuanganId: POS_A,
      tipe: 'IN',
      nominal: 123_456n,
      deskripsi: 'self-verification probe',
      createdByUserId: 'user-1',
    });

    const stored = fake.kas[0];
    const recomputedFromStoredRow = new HashChainService().computeRowHash(
      stored.prevHash,
      stored.id,
      stored.createdByUserId,
      `IN:${stored.nominal.toString()}`,
      stored.createdAt.toISOString()
    );

    expect(recomputedFromStoredRow).toBe(stored.rowHash);
    expect(stored.createdAt).toBeInstanceOf(Date);
    expect(entry.rowHash).toBe(stored.rowHash);
  });

  it('persists the exact createdAt it hashed for AUDIT rows too', async () => {
    await AuditLogService.append(asPrisma(fake), {
      rtId: RT_A,
      actorUserId: 'admin-1',
      actorRole: 'SEKRETARIS',
      actionType: 'REVEAL_PII_NIK',
      targetEntity: 'WARGA',
      targetId: 'warga-1',
      accessReason: 'AUDIT_KEAMANAN',
      ipAddress: '10.0.0.1',
      userAgent: 'vitest',
    });

    const stored = fake.audit[0];
    const recomputedFromStoredRow = new HashChainService().computeRowHash(
      stored.prevHash,
      stored.id,
      stored.actorUserId,
      `${stored.actionType}:${stored.targetId}:${stored.accessReason ?? ''}`,
      stored.createdAt.toISOString()
    );

    expect(recomputedFromStoredRow).toBe(stored.rowHash);
  });

  it('verifies each tenant chain independently', async () => {
    const pairs: ReadonlyArray<readonly [string, string, bigint]> = [
      [RT_A, POS_A, 10_000n],
      [RT_B, POS_B, 20_000n],
    ];
    for (const [rtId, posId, nominal] of pairs) {
      await LedgerService.postEntry(asPrisma(fake), {
        rtId,
        posKeuanganId: posId,
        tipe: 'IN',
        nominal,
        deskripsi: 'x',
        createdByUserId: 'u',
      });
    }

    expect((await LedgerService.verifyTenantChain(asPrisma(fake), RT_A)).isChainValid).toBe(true);
    expect((await LedgerService.verifyTenantChain(asPrisma(fake), RT_B)).isChainValid).toBe(true);
  });
});

describe('AuditLogService — per-tenant tamper-evident trail', () => {
  function auditInput(rtId: string, targetId: string, reason = 'VERIFIKASI_SURAT') {
    return {
      rtId,
      actorUserId: 'admin-1',
      actorRole: 'SEKRETARIS',
      actionType: 'REVEAL_PII_NIK',
      targetEntity: 'WARGA',
      targetId,
      accessReason: reason,
      ipAddress: '10.0.0.1',
      userAgent: 'vitest',
    };
  }

  it('anchors a tenant FIRST audit row at GENESIS with sequence 1', async () => {
    const rec = await AuditLogService.append(asPrisma(fake), auditInput(RT_A, 'warga-1'));
    expect(rec.sequence).toBe(1);
    expect(rec.prevHash).toBe(HashChainService.GENESIS_HASH);
    expect(rec.rowHash).toHaveLength(64);
  });

  it('chains audit rows of the same tenant', async () => {
    const first = await AuditLogService.append(asPrisma(fake), auditInput(RT_A, 'warga-1'));
    const second = await AuditLogService.append(asPrisma(fake), auditInput(RT_A, 'warga-2'));
    expect(second.sequence).toBe(2);
    expect(second.prevHash).toBe(first.rowHash);
  });

  it('ISOLATES tenants: RT B starts its own chain at GENESIS', async () => {
    await AuditLogService.append(asPrisma(fake), auditInput(RT_A, 'warga-a'));
    const b = await AuditLogService.append(asPrisma(fake), auditInput(RT_B, 'warga-b'));
    expect(b.prevHash).toBe(HashChainService.GENESIS_HASH);
    expect(b.sequence).toBe(1);
  });

  it('covers accessReason in the hash — altering the justification breaks the chain', async () => {
    // `accessReason` is legally meaningful ("why did you open this citizen's
    // NIK?"). Storing it outside the hash would let it be rewritten without
    // detection, so the chain must cover it.
    await AuditLogService.append(asPrisma(fake), auditInput(RT_A, 'warga-1', 'AUDIT_KEAMANAN'));

    expect((await AuditLogService.verifyTenantChain(asPrisma(fake), RT_A)).isChainValid).toBe(true);

    fake.audit[0].accessReason = 'PENANGANAN_DARURAT';

    const after = await AuditLogService.verifyTenantChain(asPrisma(fake), RT_A);
    expect(after.isChainValid).toBe(false);
    expect(after.tamperedRecordId).toBe(fake.audit[0].id);
  });

  it('detects a row inserted with a forged prevHash', async () => {
    await AuditLogService.append(asPrisma(fake), auditInput(RT_A, 'warga-1'));

    // Simulate an attacker appending a plausible-looking row that does NOT link
    // to the real chain head.
    fake.audit.push({
      id: 'AUD-FORGED',
      rtId: RT_A,
      sequence: 2,
      actorUserId: 'attacker',
      actorRole: 'SUPERUSER',
      actionType: 'REVEAL_PII_NIK',
      targetEntity: 'WARGA',
      targetId: 'warga-999',
      accessReason: null,
      ipAddress: '0.0.0.0',
      userAgent: 'curl',
      prevHash: HashChainService.GENESIS_HASH,
      rowHash: 'f'.repeat(64),
      createdAt: new Date(),
    });

    const result = await AuditLogService.verifyTenantChain(asPrisma(fake), RT_A);
    expect(result.isChainValid).toBe(false);
    expect(result.tamperedRecordId).toBe('AUD-FORGED');
  });

  it('reports an empty chain as valid (fresh tenant)', async () => {
    const result = await AuditLogService.verifyTenantChain(asPrisma(fake), RT_A);
    expect(result.isChainValid).toBe(true);
    expect(result.totalRecordsChecked).toBe(0);
  });

  it('appendBestEffort never throws, even when the store fails', async () => {
    const broken = {
      securityAuditLog: {
        findFirst: async () => {
          throw new Error('db down');
        },
        create: async () => {
          throw new Error('db down');
        },
      },
      $transaction: async () => {
        throw new Error('db down');
      },
    } as unknown as PrismaClient;

    await expect(
      AuditLogService.appendBestEffort(broken, auditInput(RT_A, 'warga-1'))
    ).resolves.toBeUndefined();
  });
});
