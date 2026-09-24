import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { assertStorageKey, type StorageProvider } from './types.js';

export interface S3StorageOptions {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

export class S3Storage implements StorageProvider {
  readonly name = 's3';
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.prefix = (options.prefix || '').replace(/^\/+|\/+$/g, '');
    this.client = new S3Client({
      region: options.region,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      ...(options.endpoint
        ? {
            endpoint: options.endpoint,
            forcePathStyle: options.forcePathStyle ?? true,
          }
        : {}),
    });
  }

  private objectKey(key: string): string {
    const safe = assertStorageKey(key);
    return this.prefix ? `${this.prefix}/${safe}` : safe;
  }

  async uploadFile(key: string, bytes: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(key),
        Body: bytes,
        ContentLength: bytes.length,
      }),
    );
  }

  async getFile(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(key),
      }),
    );
    if (!response.Body) {
      throw new Error('S3 object has no body');
    }
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(key),
      }),
    );
  }

  async getMetadata(key: string): Promise<{ size: number }> {
    const response = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(key),
      }),
    );
    return { size: response.ContentLength ?? 0 };
  }
}
