import crypto from 'node:crypto';

export interface EncryptedDocumentResult {
  encryptedBuffer: Buffer;
  encryptedDek: string;
  iv: string;
  authTag: string;
  sha256: string;
  keyVersion: string;
}

export class EnvelopeCryptoAdapter {
  private readonly kekSecret: Buffer;
  private readonly keyVersion: string;

  constructor(
    kekHexOrBase64?: string,
    keyVersion: string = process.env.KEK_CURRENT_VERSION || 'v1'
  ) {
    const rawKek = kekHexOrBase64 || process.env.KEK_SECRET_V1;
    if (process.env.NODE_ENV === 'production' && (!rawKek || rawKek.startsWith('0123456789abcdef'))) {
      throw new Error('CRITICAL SECURITY ERROR: KEK_SECRET_V1 must be set to a high-entropy key in production.');
    }
    const resolvedKek = rawKek || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    this.keyVersion = keyVersion;
    // Normalize KEK to 32 bytes (256 bits)
    if (resolvedKek.length === 64) {
      this.kekSecret = Buffer.from(resolvedKek, 'hex');
    } else {
      this.kekSecret = crypto.createHash('sha256').update(resolvedKek).digest();
    }
  }

  /**
   * Encrypt a string field (e.g. NIK or No KK) using AES-256-GCM
   * Output format: v1:base64(iv):base64(authTag):base64(ciphertext)
   */
  public encryptField(plaintext: string): string {
    const iv = crypto.randomBytes(12); // GCM standard 12-byte nonce
    const cipher = crypto.createCipheriv('aes-256-gcm', this.kekSecret, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${this.keyVersion}:${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  /**
   * Decrypt a string field encrypted with encryptField
   */
  public decryptField(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 4) {
      throw new Error('Format ciphertext tidak valid. Harus key_version:iv:authTag:ciphertext');
    }

    const [_version, ivBase64, authTagBase64, cipherTextBase64] = parts;
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const ciphertext = Buffer.from(cipherTextBase64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.kekSecret, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Encrypt a document (binary buffer) using Envelope Encryption:
   * 1. Generate unique 256-bit DEK (Data Encryption Key)
   * 2. Encrypt document with DEK
   * 3. Encrypt DEK with Master KEK
   */
  public encryptDocument(documentBuffer: Buffer): EncryptedDocumentResult {
    const dek = crypto.randomBytes(32); // 256-bit unique DEK
    const docIv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', dek, docIv);
    const encryptedDoc = Buffer.concat([
      cipher.update(documentBuffer),
      cipher.final(),
    ]);
    const docAuthTag = cipher.getAuthTag();

    // Encrypt DEK using Master KEK
    const dekIv = crypto.randomBytes(12);
    const dekCipher = crypto.createCipheriv('aes-256-gcm', this.kekSecret, dekIv);
    const encryptedDekBuffer = Buffer.concat([
      dekCipher.update(dek),
      dekCipher.final(),
    ]);
    const dekAuthTag = dekCipher.getAuthTag();

    // Packed Encrypted DEK: base64(dekIv):base64(dekAuthTag):base64(encryptedDekBuffer)
    const encryptedDek = `${dekIv.toString('base64')}:${dekAuthTag.toString('base64')}:${encryptedDekBuffer.toString('base64')}`;

    // Calculate sha256 checksum of original document
    const sha256 = crypto.createHash('sha256').update(documentBuffer).digest('hex');

    return {
      encryptedBuffer: encryptedDoc,
      encryptedDek,
      iv: docIv.toString('base64'),
      authTag: docAuthTag.toString('base64'),
      sha256,
      keyVersion: this.keyVersion,
    };
  }

  /**
   * Decrypt document by first unwrapping DEK with Master KEK, then decrypting document
   */
  public decryptDocument(
    encryptedBuffer: Buffer,
    encryptedDekPayload: string,
    docIvBase64: string,
    docAuthTagBase64: string
  ): Buffer {
    // 1. Unwrap DEK
    const dekParts = encryptedDekPayload.split(':');
    if (dekParts.length !== 3) {
      throw new Error('Payload DEK terenkripsi tidak valid');
    }
    const [dekIvBase64, dekAuthTagBase64, encDekBufferBase64] = dekParts;
    const dekIv = Buffer.from(dekIvBase64, 'base64');
    const dekAuthTag = Buffer.from(dekAuthTagBase64, 'base64');
    const encDek = Buffer.from(encDekBufferBase64, 'base64');

    const dekDecipher = crypto.createDecipheriv('aes-256-gcm', this.kekSecret, dekIv);
    dekDecipher.setAuthTag(dekAuthTag);
    const dek = Buffer.concat([
      dekDecipher.update(encDek),
      dekDecipher.final(),
    ]);

    // 2. Decrypt Document with DEK
    const docIv = Buffer.from(docIvBase64, 'base64');
    const docAuthTag = Buffer.from(docAuthTagBase64, 'base64');

    const docDecipher = crypto.createDecipheriv('aes-256-gcm', dek, docIv);
    docDecipher.setAuthTag(docAuthTag);
    const decryptedDoc = Buffer.concat([
      docDecipher.update(encryptedBuffer),
      docDecipher.final(),
    ]);

    return decryptedDoc;
  }
}

