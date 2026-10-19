import { describe, it, expect } from 'vitest';
import { Ed25519SignerAdapter } from '../infrastructure/crypto/ed25519-signer.adapter.js';

describe('Ed25519SignerAdapter', () => {
  const signer = new Ed25519SignerAdapter();

  it('harus membuat keypair Ed25519 dan menandatangani surat resmi', () => {
    const { publicKeyPem, privateKeyPem } = signer.generateKeyPair();
    expect(publicKeyPem).toContain('BEGIN PUBLIC KEY');
    expect(privateKeyPem).toContain('BEGIN PRIVATE KEY');

    const suratContent = 'SURAT_PENGANTAR:NO/001/RT05/X/2026:NIK:3201011205900001:WARGA_TETAP';
    const signatureHex = signer.sign(suratContent, privateKeyPem);

    expect(signatureHex).toBeDefined();
    expect(signatureHex.length).toBeGreaterThan(50);

    const isValid = signer.verify(suratContent, signatureHex, publicKeyPem);
    expect(isValid).toBe(true);
  });

  it('harus menggagalkan verifikasi jika isi surat telah dimanipulasi', () => {
    const { publicKeyPem, privateKeyPem } = signer.generateKeyPair();
    const suratContent = 'SURAT_PENGANTAR:NO/001/RT05/X/2026:NIK:3201011205900001:WARGA_TETAP';
    const signatureHex = signer.sign(suratContent, privateKeyPem);

    const tamperedContent = 'SURAT_PENGANTAR:NO/001/RT05/X/2026:NIK:3201011205909999:WARGA_TETAP';
    const isValid = signer.verify(tamperedContent, signatureHex, publicKeyPem);

    expect(isValid).toBe(false);
  });
});

