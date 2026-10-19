import { describe, it, expect } from 'vitest';
import { HmacBlindIndexAdapter } from '../infrastructure/crypto/blind-index.adapter.js';

describe('HmacBlindIndexAdapter', () => {
  const adapter = new HmacBlindIndexAdapter();

  it('harus menghasilkan blind index yang deterministik untuk input yang sama', () => {
    const nik1 = '3201011205900001';
    const nik2 = '3201.01.120590-0001'; // format berbeda

    const index1 = adapter.computeBlindIndex(nik1);
    const index2 = adapter.computeBlindIndex(nik2);

    expect(index1).toBe(index2);
    expect(index1.length).toBe(64); // SHA-256 hex length
  });

  it('harus menghasilkan blind index yang berbeda untuk NIK yang berbeda', () => {
    const index1 = adapter.computeBlindIndex('3201011205900001');
    const index2 = adapter.computeBlindIndex('3201011205900002');

    expect(index1).not.toBe(index2);
  });

  it('harus memask NIK dan No KK dengan benar', () => {
    const maskedNik = adapter.maskNik('3201011205900001');
    expect(maskedNik).toBe('320101******0001');

    const maskedKk = adapter.maskNoKk('3201019988770005');
    expect(maskedKk).toBe('320101******0005');
  });
});

