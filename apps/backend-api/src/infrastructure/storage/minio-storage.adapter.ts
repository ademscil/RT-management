import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

export class MinioStorageAdapter {
  private readonly client: any;

  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = process.env.MINIO_PORT || '9000';
    const useSsl = process.env.MINIO_USE_SSL === 'true';
    const accessKey = process.env.MINIO_ACCESS_KEY || 'simrt_minio_admin';
    const secretKey = process.env.MINIO_SECRET_KEY || 'simrt_minio_super_secret_2026';

    this.client = new S3Client({
      endpoint: `${useSsl ? 'https' : 'http'}://${endpoint}:${port}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }

  /**
   * Upload encrypted file buffer to private MinIO bucket
   */
  public async upload(
    bucket: string,
    key: string,
    data: Buffer,
    contentType: string = 'application/octet-stream'
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    });

    await this.client.send(command);
    return key;
  }

  /**
   * Download file buffer from MinIO bucket
   */
  public async download(bucket: string, key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    if (!response.Body) {
      throw new Error(`File tidak ditemukan di storage: ${bucket}/${key}`);
    }

    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
  }

  /**
   * Delete file from MinIO
   */
  public async delete(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Ensure bucket exists, create if missing
   */
  public async ensureBucket(bucket: string): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
      } catch (err: any) {
        if (err.name !== 'BucketAlreadyOwnedByYou' && err.name !== 'BucketAlreadyExists') {
          console.warn(`[MinIO] Ensure bucket warning for ${bucket}:`, err.message);
        }
      }
    }
  }

  public async initializeBuckets(): Promise<void> {
    const buckets = [
      process.env.S3_BUCKET_DOKUMEN_WARGA || 'dokumen-warga',
      process.env.S3_BUCKET_KAS_NOTA || 'kas-nota',
      process.env.S3_BUCKET_SURAT_ARSIP || 'surat-arsip',
    ];
    for (const b of buckets) {
      await this.ensureBucket(b);
    }
  }
}
