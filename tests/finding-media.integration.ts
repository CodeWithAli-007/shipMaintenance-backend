import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AppDataSource as db } from '../src/data-source.js';
import { createApp } from '../src/app.js';
import { Client, Vessel, Project, ProjectMember, Finding, User, MediaAsset, FindingAttachment, AuthSession } from '../src/entities/index.js';
import { AssignmentType, UserRole } from '../src/entities/enums.js';
import { storage } from '../src/storage/provider.js';
import { CSRF_COOKIE, SESSION_COOKIE, hashToken, randomToken } from '../src/lib/session.js';
import { isBase64, purgeExpiredMedia } from '../src/services/findingMedia.js';

// Uses isolated, uniquely named fixtures in the configured development database.
// Only these fixtures and their own media are removed in finally.
const ids = { client: randomUUID(), vessel: randomUUID(), project: randomUUID(), finding: randomUUID(), office: randomUUID(), member: randomUUID(), outsider: randomUUID() };
await db.initialize();
const server = createApp().listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address() as { port: number };
const base = `http://127.0.0.1:${address.port}/api/findings/${ids.finding}`;
const credentials = new Map<string, { session: string; csrf: string }>();
async function call(suffix: string, actor: string, body?: unknown) {
  const credential = credentials.get(actor)!;
  return fetch(base + suffix, { method: body ? 'POST' : 'GET', headers: { Cookie: `${SESSION_COOKIE}=${credential.session}; ${CSRF_COOKIE}=${credential.csrf}`, 'X-CSRF-Token': credential.csrf, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
}
try {
  for (const key of ['office', 'member', 'outsider'] as const) {
    await db.getRepository(User).save({ id: ids[key], fullName: `UI test ${key}`, email: `${ids[key]}@test.invalid`, role: key === 'office' ? UserRole.BACKOFFICE : UserRole.TECHNICIAN });
    const session = randomToken();
    const csrf = randomToken();
    credentials.set(ids[key], { session, csrf });
    await db.getRepository(AuthSession).save({
      user: { id: ids[key] },
      tokenHash: hashToken(session),
      csrfHash: hashToken(csrf),
      expiresAt: new Date(Date.now() + 60_000),
      lastSeenAt: new Date(),
    });
  }
  await db.getRepository(Client).save({ id: ids.client, name: 'Temporary media test' });
  await db.getRepository(Vessel).save({ id: ids.vessel, name: 'Temporary test vessel', client: { id: ids.client } });
  await db.getRepository(Project).save({ id: ids.project, projectCode: `TEST-${ids.project}`, title: 'Temporary media test', vessel: { id: ids.vessel } });
  await db.getRepository(ProjectMember).save({ project: { id: ids.project }, user: { id: ids.member }, sourceType: AssignmentType.MANUAL });
  await db.getRepository(Finding).save({ id: ids.finding, findingNumber: 1, description: 'Test observation', project: { id: ids.project }, createdBy: { id: ids.member } });
  const file = { name: 'evidence.txt', type: 'text/plain', data: Buffer.from('Test evidence').toString('base64') };
  const message = { requestId: randomUUID(), note: 'Evidence attached', files: [file] };
  assert.equal((await call('/messages', ids.outsider, message)).status, 403);
  const responses = await Promise.all([call('/messages', ids.member, message), call('/messages', ids.member, message)]);
  assert.deepEqual(responses.map(r => r.status), [201, 201]);
  const detail = (await responses[0]!.json()).finding;
  assert.equal(detail.updateCount, 1, 'concurrent retries must not duplicate updates');
  assert.equal(detail.media.length, 1, 'concurrent retries must not duplicate media');
  assert.equal(detail.media[0].updateId, message.requestId);
  const mediaPath = `/media/${detail.media[0].id}`;
  const media = await call(mediaPath, ids.member);
  assert.equal(media.status, 200);
  assert.equal(await media.text(), 'Test evidence');
  assert.equal(media.headers.get('cache-control'), 'private, no-store');
  assert.equal((await call(mediaPath, ids.outsider)).status, 403);
  assert.equal((await call(`/media/${randomUUID()}`, ids.member)).status, 404);
  const internal = { requestId: randomUUID(), note: 'Private office note', internal: true, files: [] };
  assert.equal((await call('/messages', ids.member, internal)).status, 403);
  const officeResult = await call('/messages', ids.office, internal);
  assert.equal(officeResult.status, 201);
  assert((await officeResult.json()).finding.activity.some((a: {note: string}) => a.note === internal.note));
  const memberResult = (await (await call('', ids.member)).json()).finding;
  assert(!memberResult.activity.some((a: {note: string}) => a.note === internal.note), 'internal notes must never reach technician response');
  assert.equal((await call('/messages', ids.office, { ...internal, requestId: randomUUID(), files: [file] })).status, 400);
  assert.equal((await call('/messages', ids.member, { ...message, requestId: randomUUID(), files: [{ ...file, type: 'text/html' }] })).status, 400);
  assert.equal((await call('/messages', ids.member, { ...message, requestId: randomUUID(), files: [{ ...file, data: 'invalid!' }] })).status, 400);
  assert.equal(isBase64(Buffer.alloc(4 * 1024 * 1024, 97).toString('base64')), true, 'multi-megabyte base64 must not overflow validation');
  assert.equal((await call('/messages', ids.member, { requestId: randomUUID(), note: '', files: [] })).status, 400);
  const expiresAt = new Date(detail.media[0].expiresAt).getTime();
  assert.ok(Math.abs(expiresAt - Date.now() - 30 * 24 * 60 * 60 * 1000) < 60_000, 'new files must expire in 30 days');
  await db.getRepository(MediaAsset).update(detail.media[0].id, { expiresAt: new Date(0) });
  assert.equal((await call(mediaPath, ids.member)).status, 404, 'expired files must stop downloading');
  assert.equal(await purgeExpiredMedia(), 1, 'expired files must be removed');
  await db.getRepository(ProjectMember).update({ project: { id: ids.project }, user: { id: ids.member } }, { active: false });
  assert.equal((await call(mediaPath, ids.member)).status, 403, 'revoked membership blocks existing media');
  console.log('PASS: attachment persistence, atomic retries, protected downloads, internal visibility, validation, expiry, and revoked access');
} finally {
  const links = await db.getRepository(FindingAttachment).find({ where: { finding: { id: ids.finding } }, relations: { mediaAsset: true } });
  await db.getRepository(Project).delete(ids.project);
  for (const link of links) { await db.getRepository(MediaAsset).delete(link.mediaAsset.id); await storage.deleteFile(link.mediaAsset.storageKey); }
  await db.getRepository(Vessel).delete(ids.vessel);
  await db.getRepository(Client).delete(ids.client);
  for (const key of ['office', 'member', 'outsider'] as const) await db.getRepository(User).delete(ids[key]);
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await db.destroy();
}
