import crypto from 'node:crypto';

export class Ed25519SignerAdapter {
  /**
   * Generate an Ed25519 keypair for RT official document signing
   */
  public generateKeyPair(): { publicKeyPem: string; privateKeyPem: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return {
      publicKeyPem: publicKey,
      privateKeyPem: privateKey,
    };
  }

  /**
   * Sign arbitrary data string with Ed25519 private key
   * Returns signature in hex format
   */
  public sign(data: string, privateKeyPem: string): string {
    const signature = crypto.sign(null, Buffer.from(data, 'utf8'), privateKeyPem);
    return signature.toString('hex');
  }

  /**
   * Verify Ed25519 signature
   */
  public verify(data: string, signatureHex: string, publicKeyPem: string): boolean {
    try {
      const signature = Buffer.from(signatureHex, 'hex');
      return crypto.verify(null, Buffer.from(data, 'utf8'), publicKeyPem, signature);
    } catch {
      return false;
    }
  }
}

