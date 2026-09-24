import { resolve } from 'node:path';
import { env } from '../config/env.js';
import { LocalStorage } from './LocalStorage.js';
import { S3Storage } from './S3Storage.js';
import type { StorageProvider } from './types.js';

export type { StorageProvider } from './types.js';
export { LocalStorage } from './LocalStorage.js';
export { S3Storage } from './S3Storage.js';

function createStorage(): StorageProvider {
  if (env.storage.provider === 's3') {
    const { region, bucket, accessKeyId, secretAccessKey, prefix, endpoint } = env.storage.s3;
    if (!region || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'STORAGE_PROVIDER=s3 requires AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY',
      );
    }
    return new S3Storage({
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      prefix,
      endpoint,
    });
  }

  return new LocalStorage(resolve(env.storage.localPath));
}

export const storage: StorageProvider = createStorage();
