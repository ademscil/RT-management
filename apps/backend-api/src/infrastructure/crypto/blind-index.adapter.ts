import crypto from 'node:crypto';

export class HmacBlindIndexAdapter {
  private readonly pepper: string;

  constructor(pepper?: string) {
    const rawPepper = pepper || process.env.BLIND_INDEX_PEPPER;
    if (process.env.NODE_ENV === 'production' && (!rawPepper || rawPepper.includes('super_secure_blind_index'))) {
      throw new Error('CRITICAL SECURITY ERROR: BLIND_INDEX_PEPPER must be configured in production.');
    }
    this.pepper = rawPepper || 'simrt_super_secure_blind_index_pepper_salt_998877665544332211';
  }

  /**
   * Normalize an identification string (remove spaces, dots, dashes, trim)
   */
  public normalize(value: string): string {
    return value.trim().replace(/[\s\.\-_]/g, '');
  }

  /**
   * Compute HMAC-SHA256 blind index for exact search and uniqueness validation
   */
  public computeBlindIndex(rawValue: string): string {
    const normalized = this.normalize(rawValue);
    return crypto
      .createHmac('sha256', this.pepper)
      .update(normalized)
      .digest('hex');
  }

  /**
   * Mask NIK for non-privileged views (e.g. 320101******0001)
   */
  public maskNik(nik: string): string {
    const clean = this.normalize(nik);
    if (clean.length < 10) return '****************';
    const prefix = clean.substring(0, 6);
    const suffix = clean.substring(clean.length - 4);
    return `${prefix}******${suffix}`;
  }

  /**
   * Mask No KK for non-privileged views (e.g. 320101******0002)
   */
  public maskNoKk(noKk: string): string {
    const clean = this.normalize(noKk);
    if (clean.length < 10) return '****************';
    const prefix = clean.substring(0, 6);
    const suffix = clean.substring(clean.length - 4);
    return `${prefix}******${suffix}`;
  }
}

