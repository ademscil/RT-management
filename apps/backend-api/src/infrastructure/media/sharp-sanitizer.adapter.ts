import sharp from 'sharp';

export class SharpSanitizerAdapter {
  private static activeProcesses = 0;
  private static readonly MAX_CONCURRENT_PROCESSES = 3;

  /**
   * Validate image magic bytes to ensure file is genuinely JPEG, PNG, or WebP
   */
  public isValidImageMagicBytes(buffer: Buffer): boolean {
    if (buffer.length < 12) return false;

    // JPEG: FF D8 FF
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    const isPng =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;

    // WebP: RIFF ... WEBP
    const isWebP =
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';

    return isJpeg || isPng || isWebP;
  }

  /**
   * Sanitize image buffer:
   * 1. Validate magic bytes
   * 2. Decode raw pixels, discarding any EXIF, GPS, or polyglot script payloads
   * 3. Apply diagonal tiled SVG watermark
   * 4. Re-encode to clean, compressed WebP
   */
  public async sanitizeAndWatermark(
    inputBuffer: Buffer,
    watermarkText: string = 'DOKUMEN VERIFIKASI RT 05/02 - DILARANG MENYALAHGUNAKAN'
  ): Promise<Buffer> {
    if (!this.isValidImageMagicBytes(inputBuffer)) {
      throw new Error('Format file tidak diizinkan. Hanya file gambar asli (JPEG, PNG, WebP) yang diperbolehkan.');
    }

    // Wait if too many sharp operations are running to prevent OOM
    while (SharpSanitizerAdapter.activeProcesses >= SharpSanitizerAdapter.MAX_CONCURRENT_PROCESSES) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    SharpSanitizerAdapter.activeProcesses++;

    try {
      // 1. Load image and get metadata
      const image = sharp(inputBuffer, { failOnError: true });
      const metadata = await image.metadata();
      const width = metadata.width || 1200;
      const height = metadata.height || 800;

      // 2. Generate repeating diagonal SVG watermark
      const svgWatermark = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <style>
            .watermark {
              fill: rgba(220, 38, 38, 0.25);
              font-size: 28px;
              font-family: sans-serif;
              font-weight: 700;
              letter-spacing: 2px;
            }
          </style>
          <defs>
            <pattern id="wmPattern" width="450" height="250" patternTransform="rotate(-30 0 0)" patternUnits="userSpaceOnUse">
              <text x="20" y="80" class="watermark">${watermarkText}</text>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#wmPattern)" />
        </svg>
      `;

      // 3. Composite watermark, strip EXIF metadata, and re-encode to WebP
      const sanitizedBuffer = await image
        .composite([{ input: Buffer.from(svgWatermark), top: 0, left: 0 }])
        .webp({ quality: 80, effort: 4 })
        .toBuffer();

      return sanitizedBuffer;
    } finally {
      SharpSanitizerAdapter.activeProcesses--;
    }
  }
}

