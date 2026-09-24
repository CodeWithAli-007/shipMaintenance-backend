import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AppDataSource as db } from '../src/data-source.js';
import {
  ChatMembershipOutbox,
  Client,
  Project,
  ProjectBackofficeMember,
  ProjectChatRoom,
  User,
  Vessel,
} from '../src/entities/index.js';
import { ProjectPriority, ProjectStatus, UserRole } from '../src/entities/enums.js';
import { canAccessProjectChat } from '../src/services/access.js';
import {
  addProjectBackofficeMember,
  addProjectMember,
  removeProjectBackofficeMember,
  removeProjectMember,
} from '../src/services/projects.js';

const ids = {
  client: randomUUID(),
  vessel: randomUUID(),
  project: randomUUID(),
  actor: randomUUID(),
  office: randomUUID(),
  technician: randomUUID(),
  outsider: randomUUID(),
};

await db.initialize();
try {
  for (const [key, role] of [
    ['actor', UserRole.BACKOFFICE],
    ['office', UserRole.BACKOFFICE],
    ['technician', UserRole.TECHNICIAN],
    ['outsider', UserRole.TECHNICIAN],
  ] as const) {
    await db.getRepository(User).save({
      id: ids[key],
      fullName: `Chat test ${key}`,
      email: `${ids[key]}@chat.test`,
      role,
      isActive: true,
    });
  }
  await db.getRepository(Client).save({ id: ids.client, name: 'Chat test client' });
  await db.getRepository(Vessel).save({
    id: ids.vessel,
    name: 'Chat test vessel',
    client: { id: ids.client },
  });
  await db.getRepository(Project).save({
    id: ids.project,
    projectCode: `CHAT-${ids.project}`,
    title: 'Encrypted chat membership test',
    vessel: { id: ids.vessel },
    createdBy: { id: ids.actor },
    priority: ProjectPriority.MEDIUM,
    status: ProjectStatus.OPEN,
  });
  await db.getRepository(ProjectBackofficeMember).save({
    project: { id: ids.project },
    user: { id: ids.actor },
    addedBy: { id: ids.actor },
    active: true,
  });
  await db.getRepository(ProjectChatRoom).save({
    project: { id: ids.project },
    syncStatus: 'PENDING',
  });

  const actor = {
    id: ids.actor,
    email: `${ids.actor}@chat.test`,
    fullName: 'Chat test actor',
    role: UserRole.BACKOFFICE,
  };
  assert.equal(await canAccessProjectChat(ids.actor, ids.project), true);
  assert.equal(await canAccessProjectChat(ids.outsider, ids.project), false);

  await addProjectMember(ids.project, ids.technician, actor);
  assert.equal(await canAccessProjectChat(ids.technician, ids.project), true);
  await addProjectBackofficeMember(ids.project, ids.office, actor);
  assert.equal(await canAccessProjectChat(ids.office, ids.project), true);

  await removeProjectMember(ids.project, ids.technician, actor);
  await removeProjectBackofficeMember(ids.project, ids.office, actor);
  assert.equal(await canAccessProjectChat(ids.technician, ids.project), false);
  assert.equal(await canAccessProjectChat(ids.office, ids.project), false);

  const outbox = await db.getRepository(ChatMembershipOutbox).find({
    where: { project: { id: ids.project } },
  });
  assert.deepEqual(
    outbox.map((item) => item.operation),
    ['INVITE', 'INVITE', 'REMOVE', 'REMOVE'],
    'membership changes must be mirrored to the Matrix outbox',
  );
  assert(
    outbox.every((item) => !('plaintext' in item) && !('encryptionKey' in item)),
    'membership outbox must not contain plaintext or encryption keys',
  );
  console.log('PASS: explicit chat membership, revocation, and Matrix outbox synchronization');
} finally {
  await db.getRepository(Project).delete(ids.project);
  await db.getRepository(Vessel).delete(ids.vessel);
  await db.getRepository(Client).delete(ids.client);
  for (const key of ['actor', 'office', 'technician', 'outsider'] as const) {
    await db.getRepository(User).delete(ids[key]);
  }
  await db.destroy();
}
