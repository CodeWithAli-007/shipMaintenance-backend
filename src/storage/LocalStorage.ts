import { mkdir, readFile, unlink, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertStorageKey, type StorageProvider } from './types.js';

export class LocalStorage implements StorageProvider {
  readonly name = 'local';

  constructor(private readonly root: string) {}

  private filePath(key: string): string {
    return resolve(this.root, assertStorageKey(key));
  }

  async uploadFile(key: string, bytes: Buffer): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.filePath(key), bytes, { flag: 'wx' });
  }

  getFile(key: string): Promise<Buffer> {
    return readFile(this.filePath(key));
  }

  deleteFile(key: string): Promise<void> {
    return unlink(this.filePath(key));
  }

  async getMetadata(key: string): Promise<{ size: number }> {
    return { size: (await stat(this.filePath(key))).size };
  }
}
