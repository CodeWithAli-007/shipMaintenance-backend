export interface StorageProvider {
  readonly name: string;
  uploadFile(key: string, bytes: Buffer): Promise<void>;
  getFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
  getMetadata(key: string): Promise<{ size: number }>;
}

export function assertStorageKey(key: string): string {
  if (!/^[0-9a-f-]{36}$/.test(key)) {
    throw new Error('Invalid storage key');
  }
  return key;
}
