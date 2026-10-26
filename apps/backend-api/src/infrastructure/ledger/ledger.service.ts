import { HashChainService } from './hash-chain.service.js';
import type { PrismaClient } from '@prisma/client';

export type LedgerTipe = 'IN' | 'OUT';

export interface LedgerEntryInput {
  rtId: string;
  /** Chart-of-accounts row this entry posts to. */
  posKeuanganId: string;
  tipe: LedgerTipe;
  nominal: bigint;
  deskripsi: string;
  createdByUserId: string;
  approvedByUserId?: string | null;
  buktiNotaMinioKey?: string | null;
  /**
   * Extra writes that must commit atomically WITH the ledger entry
   * (e.g. flipping the bill to PAID). Runs inside the same transaction, after
   * the ledger row is written, so a failure rolls the whole thing back.
   */
  extraWork?: (tx: PrismaClient, ctx: LedgerPostContext) => Promise<void>;
}

export interface LedgerPostContext {
  ledgerId: string;
  sequence: number;
  rowHash: string;
  prevHash: string;
  saldoSebelum: bigint;
  saldoSetelah: bigint;
}

export interface LedgerEntryRecord {
  id: string;
  rtId: string;
  sequence: number;
  posKeuanganId: string;
  tipe: string;
  nominal: bigint;
  saldoSetelah: bigint;
  prevHash: string;
  rowHash: string;
  createdAt: Date;
}

const WRITE_CONFLICT = 'P2034';
const MAX_ATTEMPTS = 5;

/**
 * ==============================================================================
 * PER-TENANT IMMUTABLE CASH LEDGER
 * ==============================================================================
 * `kas_ledger_immutable` is the RT's book of record. Each row joins a SHA-256
 * chain scoped to ONE tenant:
 *
 *   rowHash = SHA256(prevHash : id : actorId : "IN|OUT:nominal" : timestamp)
 *
 * Problems this service fixes versus the previous inline implementation:
 *
 *  1. CROSS-TENANT CHAIN LEAK — the old code read
 *     `kasLedgerImmutable.findFirst({ orderBy: { createdAt: 'desc' } })` with no
 *     tenant predicate, so RT A's entry chained onto RT B's rowHash. Every
 *     tenant except the very first would then FAIL ledger verification.
 *
 *  2. RACE / FORK — prevHash was read outside the writing transaction. Two
 *     concurrent payments both read the same predecessor and produced two rows
 *     claiming the same parent: a permanent, unverifiable fork. Sequence and
 *     hash are now computed under SERIALIZABLE isolation with bounded retry.
 *
 *  3. NON-ATOMIC BALANCE — balance update and ledger insert were issued as a
 *     batch `$transaction([...])` after computing saldo from a STALE read, so a
 *     concurrent writer could interleave and corrupt the running balance. Both
 *     now happen inside one transaction against a freshly-read balance.
 */
export class LedgerService {
  private static readonly chain = new HashChainService();
  public static readonly GENESIS_HASH = HashChainService.GENESIS_HASH;

  /** Canonical hash payload — shared by post and verify so they cannot drift. */
  private static hashPayload(tipe: LedgerTipe, nominal: bigint): string {
    return `${tipe}:${nominal.toString()}`;
  }

  /**
   * Post one immutable ledger entry, atomically with its balance update.
   * Returns the persisted row. Throws only after every retry is exhausted.
   */
  public static async postEntry(
    prisma: PrismaClient,
    input: LedgerEntryInput
  ): Promise<LedgerEntryRecord> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await prisma.$transaction(
          async (tx) => {
            const client = tx as unknown as PrismaClient;

            // 1. Re-read the posting account INSIDE the transaction.
            const pos = await client.posKeuangan.findFirst({
              where: { id: input.posKeuanganId, rtId: input.rtId },
            });
            if (!pos) {
              throw new Error(
                `[LedgerService] Pos keuangan ${input.posKeuanganId} not found for tenant ${input.rtId}.`
              );
            }

            const saldoSebelum = pos.saldoBerjalan;
            if (input.tipe === 'OUT' && saldoSebelum < input.nominal) {
              throw new Error('[LedgerService] INSUFFICIENT_FUNDS');
            }
            const saldoSetelah =
              input.tipe === 'IN' ? saldoSebelum + input.nominal : saldoSebelum - input.nominal;

            // 2. Chain link for THIS tenant only.
            const last = await client.kasLedgerImmutable.findFirst({
              where: { rtId: input.rtId },
              orderBy: { sequence: 'desc' },
              select: { sequence: true, rowHash: true },
            });

            const sequence = (last?.sequence ?? 0) + 1;
            const prevHash = last?.rowHash ?? HashChainService.GENESIS_HASH;
            const ledgerId = `KAS-${input.tipe}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
            const postedAt = new Date();
            const timestampIso = postedAt.toISOString();

            const rowHash = LedgerService.chain.computeRowHash(
              prevHash,
              ledgerId,
              input.createdByUserId,
              LedgerService.hashPayload(input.tipe, input.nominal),
              timestampIso
            );

            // 3. Append the immutable row.
            //
            // `createdAt` is written EXPLICITLY. It must be the exact instant that
            // fed `computeRowHash` above. Relying on the column default
            // (`@default(now())`) would persist a timestamp microseconds later
            // than the hashed one, so `verifyTenantChain()` — which recomputes the
            // hash from `created_at` — would report EVERY entry as tampered.
            const created = await client.kasLedgerImmutable.create({
              data: {
                id: ledgerId,
                rtId: input.rtId,
                sequence,
                posKeuanganId: input.posKeuanganId,
                tipe: input.tipe,
                nominal: input.nominal,
                saldoSetelah,
                deskripsi: input.deskripsi,
                buktiNotaMinioKey: input.buktiNotaMinioKey ?? null,
                createdByUserId: input.createdByUserId,
                approvedByUserId: input.approvedByUserId ?? null,
                prevHash,
                rowHash,
                createdAt: postedAt,
              },
            });

            // 4. Move the balance (same transaction — cannot interleave).
            await client.posKeuangan.update({
              where: { id: input.posKeuanganId },
              data: { saldoBerjalan: saldoSetelah },
            });

            // 5. Caller-supplied writes that must commit with the entry.
            if (input.extraWork) {
              await input.extraWork(client, {
                ledgerId,
                sequence,
                rowHash,
                prevHash,
                saldoSebelum,
                saldoSetelah,
              });
            }

            return created as LedgerEntryRecord;
          },
          { isolationLevel: 'Serializable' }
        );
      } catch (err: unknown) {
        lastError = err;
        const code = (err as { code?: string } | null)?.code;
        if (code !== WRITE_CONFLICT) throw err;
        await new Promise((r) => setTimeout(r, 10 * attempt + Math.floor(Math.random() * 25)));
      }
    }

    throw lastError;
  }

  /** Recompute a tenant's ledger chain and report the first tampered position. */
  public static async verifyTenantChain(
    prisma: PrismaClient,
    rtId: string
  ): Promise<ReturnType<HashChainService['verifyChain']>> {
    const rows = await prisma.kasLedgerImmutable.findMany({
      where: { rtId },
      orderBy: { sequence: 'asc' },
      select: {
        id: true,
        createdByUserId: true,
        tipe: true,
        nominal: true,
        prevHash: true,
        rowHash: true,
        createdAt: true,
      },
    });

    const records = rows.map((r) => ({
      id: r.id,
      actorId: r.createdByUserId,
      actionOrNominal: LedgerService.hashPayload(r.tipe as LedgerTipe, r.nominal),
      timestampIso: r.createdAt.toISOString(),
      prevHash: r.prevHash,
      rowHash: r.rowHash,
    }));

    return LedgerService.chain.verifyChain(records);
  }
}
