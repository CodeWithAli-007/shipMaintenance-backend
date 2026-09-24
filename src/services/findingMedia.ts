import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { LessThanOrEqual } from 'typeorm';
import { AppDataSource } from '../data-source.js';
import { env } from '../config/env.js';
import { Finding } from '../entities/Finding.js';
import { FindingUpdate } from '../entities/FindingUpdate.js';
import { FindingComment } from '../entities/FindingComment.js';
import { FindingAttachment } from '../entities/FindingAttachment.js';
import { MediaAsset } from '../entities/MediaAsset.js';
import { CommentVisibility, MediaType } from '../entities/enums.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import { storage } from '../storage/provider.js';
import { canAccessFinding, isBackofficeRole } from './access.js';
import { uuidString } from '../routes/schemas.js';
import type { AuthUser } from '../types/index.js';

export function mediaExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + env.mediaRetentionDays * 24 * 60 * 60 * 1000);
}

export function isMediaExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export const messageBody = z.object({
  requestId: uuidString,
  note: z.string().trim().max(10000),
  internal: z.boolean().default(false),
  files: z.array(z.object({ name: z.string().min(1).max(512), type: z.string().max(255), data: z.string().max(28000000) })).max(8).default([]),
}).refine(v => v.note.length > 0 || v.files.length > 0, 'Write a message or attach a file');
const mimeTypes: Record<string, MediaType> = {
  'image/jpeg': MediaType.IMAGE, 'image/png': MediaType.IMAGE, 'image/webp': MediaType.IMAGE, 'image/gif': MediaType.IMAGE,
  'video/mp4': MediaType.VIDEO, 'video/webm': MediaType.VIDEO, 'video/quicktime': MediaType.VIDEO,
  'audio/webm': MediaType.AUDIO, 'audio/ogg': MediaType.AUDIO, 'audio/mpeg': MediaType.AUDIO, 'audio/mp4': MediaType.AUDIO, 'audio/wav': MediaType.AUDIO,
  'application/pdf': MediaType.DOCUMENT, 'text/plain': MediaType.DOCUMENT,
  'application/msword': MediaType.DOCUMENT, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': MediaType.DOCUMENT,
  'application/vnd.ms-excel': MediaType.DOCUMENT, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': MediaType.DOCUMENT,
};
/** Linear scan — a single /(?:....)* / regex overflows V8's stack on large attachments. */
export function isBase64(value: string): boolean {
  const length = value.length;
  if (!length || length % 4 !== 0) return false;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  for (let i = 0; i < length - padding; i++) {
    const code = value.charCodeAt(i);
    if (
      (code < 48 || code > 57) &&
      (code < 65 || code > 90) &&
      (code < 97 || code > 122) &&
      code !== 43 &&
      code !== 47
    ) {
      return false;
    }
  }
  return true;
}

export async function assertFindingAccess(id: string, actor: AuthUser) {
  if (isBackofficeRole(actor.role)) return;
  if (!await canAccessFinding(actor.id, id)) throw new ForbiddenError('No active project membership');
}
export async function saveMessage(id: string, input: z.infer<typeof messageBody>, actor: AuthUser) {
  await assertFindingAccess(id, actor);
  if (input.internal && !isBackofficeRole(actor.role)) throw new ForbiddenError('Only backoffice can write internal notes');
  if (input.internal && input.files.length) throw new ValidationError('Internal notes support text only. Send evidence in the shared conversation.');
  let total = 0;
  const files = input.files.map(file => {
    const mime = file.type.split(';')[0]!.toLowerCase();
    const type = mimeTypes[mime];
    if (!type) throw new ValidationError(`Unsupported file type: ${file.name}`);
    if (!isBase64(file.data)) throw new ValidationError('Invalid file encoding');
    const bytes = Buffer.from(file.data, 'base64');
    total += bytes.length;
    if (!bytes.length || total > 20 * 1024 * 1024) throw new ValidationError('Attachments must be nonempty and total at most 20 MB');
    return { ...file, mime, type, bytes };
  });
  const written: string[] = [];
  try {
    await AppDataSource.transaction(async manager => {
      // Serialize retries so a lost response never duplicates an update or its files.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [input.requestId]);
      const existingUpdate = await manager.findOne(FindingUpdate, { where: { id: input.requestId }, relations: { finding: true, createdBy: true } });
      const existingComment = await manager.findOne(FindingComment, { where: { id: input.requestId }, relations: { finding: true, user: true } });
      if (existingUpdate || existingComment) {
        const existing = existingUpdate || existingComment!;
        const owner = existingUpdate?.createdBy?.id || existingComment?.user.id;
        if (existing.finding.id !== id || owner !== actor.id) throw new ForbiddenError('Request identifier already used');
        return;
      }
      if (!await manager.exists(Finding, { where: { id } })) throw new NotFoundError('Finding not found');
      if (input.internal) {
        await manager.save(FindingComment, manager.create(FindingComment, { id: input.requestId, finding: { id }, user: { id: actor.id }, comment: input.note, visibility: CommentVisibility.INTERNAL }));
      } else {
        const update = await manager.save(FindingUpdate, manager.create(FindingUpdate, { id: input.requestId, finding: { id }, createdBy: { id: actor.id }, note: input.note }));
        for (const [index, file] of files.entries()) {
          const key = randomUUID();
          await storage.uploadFile(key, file.bytes); written.push(key);
          const asset = await manager.save(MediaAsset, manager.create(MediaAsset, { uploadedBy: { id: actor.id }, mediaType: file.type, originalFilename: file.name, mimeType: file.mime, storageProvider: storage.name, storageKey: key, fileSizeBytes: String(file.bytes.length), metadata: {}, expiresAt: mediaExpiresAt() }));
          await manager.save(FindingAttachment, manager.create(FindingAttachment, { finding: { id }, findingUpdate: update, mediaAsset: asset, sortOrder: index }));
        }
        await manager.update(Finding, id, { updatedAt: new Date() });
      }
    });
  } catch (error) {
    await Promise.allSettled(written.map(key => storage.deleteFile(key)));
    throw error;
  }
}
export async function getMediaFile(findingId: string, mediaId: string, actor: AuthUser) {
  await assertFindingAccess(findingId, actor);
  const link = await AppDataSource.getRepository(FindingAttachment).findOne({ where: { finding: { id: findingId }, mediaAsset: { id: mediaId } }, relations: { mediaAsset: true } });
  if (!link || isMediaExpired(link.mediaAsset.expiresAt)) throw new NotFoundError('Media not found');
  if (link.mediaAsset.storageProvider !== storage.name) throw new NotFoundError('Storage provider unavailable');
  try { return { asset: link.mediaAsset, bytes: await storage.getFile(link.mediaAsset.storageKey) }; }
  catch { throw new NotFoundError('Media file unavailable'); }
}

export async function purgeExpiredMedia(now = new Date()): Promise<number> {
  const expired = await AppDataSource.getRepository(MediaAsset).find({
    where: { expiresAt: LessThanOrEqual(now) },
  });
  for (const asset of expired) {
    await AppDataSource.transaction(async manager => {
      await manager.delete(FindingAttachment, { mediaAsset: { id: asset.id } });
      await manager.delete(MediaAsset, { id: asset.id });
    });
    await storage.deleteFile(asset.storageKey).catch(() => undefined);
  }
  return expired.length;
}
