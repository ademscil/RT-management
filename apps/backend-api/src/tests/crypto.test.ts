import { describe, it, expect } from 'vitest';
import { EnvelopeCryptoAdapter } from '../infrastructure/crypto/envelope-crypto.adapter.js';

describe('EnvelopeCryptoAdapter', () => {
  const adapter = new EnvelopeCryptoAdapter();

  it('harus mengenkripsi dan mendekripsi string NIK / No KK dengan benar', () => {
    const originalNik = '3201011205900001';
    const encrypted = adapter.encryptField(originalNik);

    expect(encrypted).toContain(':');
    const parts = encrypted.split(':');
    expect(parts.length).toBe(4);
    expect(parts[0]).toBe('v1'); // key version

    const decrypted = adapter.decryptField(encrypted);
    expect(decrypted).toBe(originalNik);
  });

  it('harus melempar error jika ciphertext dimanipulasi', () => {
    const originalNik = '3201011205900001';
    const encrypted = adapter.encryptField(originalNik);
    const parts = encrypted.split(':');

    // Manipulasi ciphertext
    parts[3] = Buffer.from('manipulated_data').toString('base64');
    const tampered = parts.join(':');

    expect(() => adapter.decryptField(tampered)).toThrow();
  });

  it('harus melakukan envelope encryption pada dokumen biner', () => {
    const dummyDocument = Buffer.from('KONTEN_RAHASIA_FOTO_KTP_WARGA_12345', 'utf8');

    const result = adapter.encryptDocument(dummyDocument);

    expect(result.keyVersion).toBe('v1');
    expect(result.encryptedBuffer).toBeInstanceOf(Buffer);
    expect(result.encryptedDek).toBeDefined();
    expect(result.iv).toBeDefined();
    expect(result.authTag).toBeDefined();
    expect(result.sha256).toBeDefined();

    const decrypted = adapter.decryptDocument(
      result.encryptedBuffer,
      result.encryptedDek,
      result.iv,
      result.authTag
    );

    expect(decrypted.toString('utf8')).toBe('KONTEN_RAHASIA_FOTO_KTP_WARGA_12345');
  });
});

