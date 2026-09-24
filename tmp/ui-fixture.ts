import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { AppDataSource as db } from '../src/data-source.js';
import { Client, Vessel, Project, Finding, MediaAsset, FindingAttachment, User } from '../src/entities/index.js';
import { UserRole } from '../src/entities/enums.js';
import { storage } from '../src/storage/provider.js';
import { saveMessage } from '../src/services/findingMedia.js';
await db.initialize();
try {
  if (process.argv.includes('--cleanup')) {
    const ids = JSON.parse(await readFile('tmp/ui-fixture.json', 'utf8'));
    const links = await db.getRepository(FindingAttachment).find({ where: { finding: { id: ids.finding } }, relations: { mediaAsset: true } });
    await db.getRepository(Project).delete(ids.project);
    for (const link of links) { await db.getRepository(MediaAsset).delete(link.mediaAsset.id); await storage.deleteFile(link.mediaAsset.storageKey); }
    await db.getRepository(Vessel).delete(ids.vessel);
    await db.getRepository(Client).delete(ids.client);
    console.log('Temporary UI fixture removed');
  } else {
    const ids = { client: randomUUID(), vessel: randomUUID(), project: randomUUID(), finding: randomUUID() };
    await writeFile('tmp/ui-fixture.json', JSON.stringify(ids));
    const office = await db.getRepository(User).findOneByOrFail({ role: UserRole.BACKOFFICE });
    await db.getRepository(Client).save({ id: ids.client, name: 'Temporary UI verification' });
    await db.getRepository(Vessel).save({ id: ids.vessel, name: 'Test vessel', client: { id: ids.client } });
    await db.getRepository(Project).save({ id: ids.project, projectCode: `QA-${ids.project}`, title: 'Temporary workspace verification', vessel: { id: ids.vessel } });
    await db.getRepository(Finding).save({ id: ids.finding, findingNumber: 1, title: 'Evidence preview check', description: 'Temporary fixture for checking attachment previews and chat layout.', project: { id: ids.project }, createdBy: office });
    const actor = { id: office.id, fullName: office.fullName, email: office.email, role: office.role };
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    await saveMessage(ids.finding, { requestId: randomUUID(), note: 'Image and document attached for preview verification.', internal: false, files: [{ name: 'preview-check.png', type: 'image/png', data: png }, { name: 'inspection-note.txt', type: 'text/plain', data: Buffer.from('Temporary evidence for UI verification').toString('base64') }] }, actor);
    console.log(`http://127.0.0.1:5173/findings/${ids.finding}`);
  }
} finally { await db.destroy(); }
