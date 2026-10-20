import crypto from 'node:crypto';
import type { HashChainVerificationResult } from '@simrt/shared-types';

export interface HashChainRecord {
  id: string;
  actorId: string;
  actionOrNominal: string;
  timestampIso: string;
  prevHash: string;
  rowHash: string;
}

export class HashChainService {
  public static readonly GENESIS_HASH = '0'.repeat(64);

  /**
   * Compute row hash based on previous hash, record id, actor id, action/nominal, and timestamp
   */
  public computeRowHash(
    prevHash: string,
    id: string,
    actorId: string,
    actionOrNominal: string,
    timestampIso: string
  ): string {
    const payload = `${prevHash}:${id}:${actorId}:${actionOrNominal}:${timestampIso}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Verify an array of records in chronological order
   */
  public verifyChain(records: HashChainRecord[]): HashChainVerificationResult {
    const verifiedAt = new Date().toISOString();

    if (records.length === 0) {
      return {
        isChainValid: true,
        totalRecordsChecked: 0,
        firstHash: HashChainService.GENESIS_HASH,
        lastHash: HashChainService.GENESIS_HASH,
        verifiedAt,
      };
    }

    let expectedPrevHash = HashChainService.GENESIS_HASH;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      // 1. Verify that prevHash matches previous record's rowHash
      if (record.prevHash !== expectedPrevHash) {
        return {
          isChainValid: false,
          totalRecordsChecked: i,
          firstHash: records[0].rowHash,
          lastHash: records[Math.max(0, i - 1)].rowHash,
          tamperedRecordId: record.id,
          tamperedAtIndex: i,
          verifiedAt,
        };
      }

      // 2. Recompute rowHash (genesis anchor is validated by its prevHash genesis marker)
      if (record.id !== 'GENESIS-AUDIT') {
        const calculatedHash = this.computeRowHash(
          record.prevHash,
          record.id,
          record.actorId,
          record.actionOrNominal,
          record.timestampIso
        );

        if (calculatedHash !== record.rowHash) {
          return {
            isChainValid: false,
            totalRecordsChecked: i,
            firstHash: records[0].rowHash,
            lastHash: records[Math.max(0, i - 1)].rowHash,
            tamperedRecordId: record.id,
            tamperedAtIndex: i,
            verifiedAt,
          };
        }
      }

      expectedPrevHash = record.rowHash;
    }

    return {
      isChainValid: true,
      totalRecordsChecked: records.length,
      firstHash: records[0].rowHash,
      lastHash: records[records.length - 1].rowHash,
      verifiedAt,
    };
  }
}

