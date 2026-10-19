import { describe, it, expect } from 'vitest';
import { HashChainService, type HashChainRecord } from '../infrastructure/ledger/hash-chain.service.js';

describe('HashChainService', () => {
  const service = new HashChainService();

  it('harus memvalidasi rantai hash buku kas yang sah (unaltered chain)', () => {
    const records: HashChainRecord[] = [];

    // Baris 1 (Genesis prevHash)
    const prevHash0 = HashChainService.GENESIS_HASH;
    const id1 = 'kas-001';
    const actorId1 = 'user-bendahara-01';
    const action1 = 'IN:1500000';
    const time1 = '2026-10-01T08:00:00.000Z';
    const hash1 = service.computeRowHash(prevHash0, id1, actorId1, action1, time1);

    records.push({
      id: id1,
      actorId: actorId1,
      actionOrNominal: action1,
      timestampIso: time1,
      prevHash: prevHash0,
      rowHash: hash1,
    });

    // Baris 2
    const id2 = 'kas-002';
    const actorId2 = 'user-bendahara-01';
    const action2 = 'OUT:350000';
    const time2 = '2026-10-02T10:30:00.000Z';
    const hash2 = service.computeRowHash(hash1, id2, actorId2, action2, time2);

    records.push({
      id: id2,
      actorId: actorId2,
      actionOrNominal: action2,
      timestampIso: time2,
      prevHash: hash1,
      rowHash: hash2,
    });

    const result = service.verifyChain(records);

    expect(result.isChainValid).toBe(true);
    expect(result.totalRecordsChecked).toBe(2);
    expect(result.firstHash).toBe(hash1);
    expect(result.lastHash).toBe(hash2);
    expect(result.tamperedRecordId).toBeUndefined();
  });

  it('harus mendeteksi manipulasi nominal atau record yang disusupi di tengah rantai (tampered ledger)', () => {
    const records: HashChainRecord[] = [];

    const prevHash0 = HashChainService.GENESIS_HASH;
    const hash1 = service.computeRowHash(prevHash0, 'kas-001', 'user-01', 'IN:1000000', '2026-10-01T08:00:00Z');
    records.push({
      id: 'kas-001',
      actorId: 'user-01',
      actionOrNominal: 'IN:1000000',
      timestampIso: '2026-10-01T08:00:00Z',
      prevHash: prevHash0,
      rowHash: hash1,
    });

    const hash2 = service.computeRowHash(hash1, 'kas-002', 'user-01', 'OUT:200000', '2026-10-02T08:00:00Z');
    records.push({
      id: 'kas-002',
      actorId: 'user-01',
      actionOrNominal: 'OUT:200000',
      timestampIso: '2026-10-02T08:00:00Z',
      prevHash: hash1,
      rowHash: hash2,
    });

    // Manipulasi: seseorang mengubah nominal transaksi kas-002 secara ilegal di database tanpa update hash
    records[1].actionOrNominal = 'OUT:20000'; // nominal diubah dari 200rb jadi 20rb

    const result = service.verifyChain(records);

    expect(result.isChainValid).toBe(false);
    expect(result.tamperedRecordId).toBe('kas-002');
    expect(result.tamperedAtIndex).toBe(1);
  });
});

