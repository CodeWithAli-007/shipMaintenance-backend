import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { LessThanOrEqual } from 'typeorm';
import { AppDataSource } from '../data-source.js';
import { ChatMembershipOutbox } from '../entities/ChatMembershipOutbox.js';
import { MatrixUserIdentity } from '../entities/MatrixUserIdentity.js';
import { ProjectBackofficeMember } from '../entities/ProjectBackofficeMember.js';
import { ProjectChatRoom } from '../entities/ProjectChatRoom.js';
import { ProjectMember } from '../entities/ProjectMember.js';
import { User } from '../entities/User.js';
import { env } from '../config/env.js';
import { AppError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { canAccessProjectChat } from './access.js';
import type { AuthUser } from '../types/index.js';

type MatrixResponse = Record<string, unknown>;
let adminTokenPromise: Promise<string> | null = null;
let outboxProcessing = false;

function matrixUsername(userId: string): string {
  return `sm_${userId.replaceAll('-', '').toLowerCase()}`;
}

function matrixUserId(username: string): string {
  return `@${username}:${env.matrix.serverName}`;
}

function matrixUserPassword(userId: string): string {
  return createHmac('sha256', env.matrix.userPasswordSecret)
    .update(userId)
    .digest('base64url');
}

async function matrixRequest<T extends MatrixResponse>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  let response: Response;
  try {
    response = await fetch(`${env.matrix.internalUrl}${path}`, { ...init, headers });
  } catch {
    throw new AppError('Encrypted chat service is unavailable', 503, 'MATRIX_UNAVAILABLE');
  }
  const body = (await response.json().catch(() => ({}))) as T & {
    errcode?: string;
    error?: string;
  };
  if (!response.ok) {
    throw new AppError(
      body.error || `Matrix request failed (${response.status})`,
      502,
      body.errcode || 'MATRIX_ERROR',
    );
  }
  return body;
}

async function loginAdmin(): Promise<string> {
  const result = await matrixRequest<{ access_token?: string }>(
    '/_matrix/client/v3/login',
    {
      method: 'POST',
      body: JSON.stringify({
        type: 'm.login.password',
        identifier: { type: 'm.id.user', user: env.matrix.adminUsername },
        password: env.matrix.adminPassword,
        device_id: 'SHIPMAINTENANCE_BRIDGE',
        initial_device_display_name: 'ShipMaintain membership bridge',
      }),
    },
  );
  if (!result.access_token) throw new AppError('Matrix admin login returned no token', 502);
  return result.access_token;
}

async function registerAdmin(): Promise<void> {
  const secret = (await readFile(env.matrix.registrationSecretFile, 'utf8')).trim();
  const nonceResult = await matrixRequest<{ nonce?: string }>('/_synapse/admin/v1/register');
  if (!nonceResult.nonce) throw new AppError('Matrix registration nonce unavailable', 502);
  const macPayload = [
    nonceResult.nonce,
    env.matrix.adminUsername,
    env.matrix.adminPassword,
    'admin',
  ].join('\0');
  const mac = createHmac('sha1', secret).update(macPayload).digest('hex');
  await matrixRequest('/_synapse/admin/v1/register', {
    method: 'POST',
    body: JSON.stringify({
      nonce: nonceResult.nonce,
      username: env.matrix.adminUsername,
      password: env.matrix.adminPassword,
      admin: true,
      mac,
    }),
  });
}

async function getAdminToken(): Promise<string> {
  adminTokenPromise ??= (async () => {
    try {
      return await loginAdmin();
    } catch {
      await registerAdmin();
      return loginAdmin();
    }
  })().catch((error) => {
    adminTokenPromise = null;
    throw error;
  });
  return adminTokenPromise;
}

export async function ensureMatrixIdentity(user: User): Promise<MatrixUserIdentity> {
  const repo = AppDataSource.getRepository(MatrixUserIdentity);
  const existing = await repo.findOne({ where: { user: { id: user.id } }, relations: { user: true } });
  if (existing) return existing;

  const username = matrixUsername(user.id);
  const id = matrixUserId(username);
  const adminToken = await getAdminToken();
  await matrixRequest(
    `/_synapse/admin/v2/users/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        password: matrixUserPassword(user.id),
        displayname: user.fullName,
        admin: false,
        deactivated: false,
      }),
    },
    adminToken,
  );
  try {
    return await repo.save(
      repo.create({ user, matrixUserId: id, matrixUsername: username }),
    );
  } catch {
    const raced = await repo.findOne({ where: { user: { id: user.id } }, relations: { user: true } });
    if (!raced) throw new AppError('Could not create Matrix identity', 500);
    return raced;
  }
}

async function loginAs(
  identity: MatrixUserIdentity,
  deviceId: string,
): Promise<{ accessToken: string; deviceId?: string }> {
  const result = await matrixRequest<{ access_token?: string; device_id?: string }>(
    '/_matrix/client/v3/login',
    {
      method: 'POST',
      body: JSON.stringify({
        type: 'm.login.password',
        identifier: { type: 'm.id.user', user: identity.matrixUserId },
        password: matrixUserPassword(identity.user.id),
        device_id: deviceId,
        initial_device_display_name: deviceId.startsWith('SHIP_BRIDGE_')
          ? 'ShipMaintain membership bridge'
          : 'ShipMaintain web',
      }),
    },
  );
  if (!result.access_token) throw new AppError('Matrix user login returned no token', 502);
  return { accessToken: result.access_token, deviceId: result.device_id };
}

async function activeParticipants(projectId: string): Promise<User[]> {
  const [technical, backoffice] = await Promise.all([
    AppDataSource.getRepository(ProjectMember).find({
      where: { project: { id: projectId }, active: true },
      relations: { user: true },
    }),
    AppDataSource.getRepository(ProjectBackofficeMember).find({
      where: { project: { id: projectId }, active: true },
      relations: { user: true },
    }),
  ]);
  const unique = new Map<string, User>();
  for (const membership of [...technical, ...backoffice]) {
    if (membership.user.isActive) unique.set(membership.user.id, membership.user);
  }
  return [...unique.values()];
}

async function createRoom(outbox: ChatMembershipOutbox): Promise<void> {
  const roomRepo = AppDataSource.getRepository(ProjectChatRoom);
  const room = await roomRepo.findOne({
    where: { project: { id: outbox.project.id } },
    relations: { project: true },
  });
  if (!room) throw new NotFoundError('Project chat room mapping not found');
  if (room.matrixRoomId) return;

  const participants = await activeParticipants(outbox.project.id);
  if (participants.length === 0) throw new AppError('Project chat has no participants', 409);
  const identities = await Promise.all(participants.map(ensureMatrixIdentity));
  const creator = identities[0]!;
  const creatorLogin = await loginAs(creator, `SHIP_BRIDGE_${creator.user.id.slice(0, 8)}`);
  const result = await matrixRequest<{ room_id?: string }>(
    '/_matrix/client/v3/createRoom',
    {
      method: 'POST',
      body: JSON.stringify({
        visibility: 'private',
        preset: 'private_chat',
        name: `${room.project.projectCode} · ${room.project.title}`,
        invite: identities.slice(1).map((identity) => identity.matrixUserId),
        initial_state: [
          {
            type: 'm.room.encryption',
            state_key: '',
            content: { algorithm: 'm.megolm.v1.aes-sha2' },
          },
          {
            type: 'm.room.history_visibility',
            state_key: '',
            content: { history_visibility: 'joined' },
          },
          {
            type: 'm.room.guest_access',
            state_key: '',
            content: { guest_access: 'forbidden' },
          },
        ],
      }),
    },
    creatorLogin.accessToken,
  );
  if (!result.room_id) throw new AppError('Matrix room creation returned no room id', 502);
  room.matrixRoomId = result.room_id;
  room.syncStatus = 'READY';
  room.lastError = null;
  await roomRepo.save(room);
}

async function membershipActor(projectId: string, excludedUserId?: string): Promise<{
  token: string;
}> {
  const participants = (await activeParticipants(projectId)).filter(
    (participant) => participant.id !== excludedUserId,
  );
  if (participants.length === 0) throw new AppError('No active chat member can update the room', 409);
  const identity = await ensureMatrixIdentity(participants[0]!);
  return {
    token: (await loginAs(identity, `SHIP_BRIDGE_${identity.user.id.slice(0, 8)}`)).accessToken,
  };
}

async function syncMembership(outbox: ChatMembershipOutbox): Promise<void> {
  if (!outbox.user) throw new AppError('Membership outbox item has no user', 500);
  const room = await AppDataSource.getRepository(ProjectChatRoom).findOne({
    where: { project: { id: outbox.project.id } },
  });
  if (!room?.matrixRoomId) throw new AppError('Matrix room is not ready', 409);
  const target = await ensureMatrixIdentity(outbox.user);
  const actor = await membershipActor(outbox.project.id, outbox.operation === 'REMOVE' ? outbox.user.id : undefined);
  const endpoint = outbox.operation === 'INVITE' ? 'invite' : 'kick';
  try {
    await matrixRequest(
      `/_matrix/client/v3/rooms/${encodeURIComponent(room.matrixRoomId)}/${endpoint}`,
      {
        method: 'POST',
        body: JSON.stringify({
          user_id: target.matrixUserId,
          ...(endpoint === 'kick' ? { reason: 'Project membership removed' } : {}),
        }),
      },
      actor.token,
    );
  } catch (error) {
    if (error instanceof AppError && /already|not in the room/i.test(error.message)) return;
    throw error;
  }
}

export async function processChatOutbox(limit = 20): Promise<number> {
  if (outboxProcessing) return 0;
  outboxProcessing = true;
  try {
  const repo = AppDataSource.getRepository(ChatMembershipOutbox);
  const items = await repo.find({
    where: [
      { status: 'PENDING', nextAttemptAt: LessThanOrEqual(new Date()) },
      { status: 'FAILED', nextAttemptAt: LessThanOrEqual(new Date()) },
    ],
    relations: { project: true, user: true },
    order: { createdAt: 'ASC' },
    take: limit,
  });
  for (const item of items) {
    item.status = 'PROCESSING';
    item.attempts += 1;
    await repo.save(item);
    try {
      if (item.operation === 'CREATE_ROOM') await createRoom(item);
      else await syncMembership(item);
      item.status = 'COMPLETED';
      item.lastError = null;
    } catch (error) {
      item.status = 'FAILED';
      item.lastError = error instanceof Error ? error.message.slice(0, 2000) : 'Unknown Matrix error';
      item.nextAttemptAt = new Date(Date.now() + Math.min(300, 2 ** item.attempts) * 1000);
      if (item.operation === 'CREATE_ROOM') {
        await AppDataSource.getRepository(ProjectChatRoom).update(
          { project: { id: item.project.id } },
          { syncStatus: 'ERROR', lastError: item.lastError },
        );
      }
    }
    await repo.save(item);
  }
  return items.length;
  } finally {
    outboxProcessing = false;
  }
}

export async function getProjectChatBootstrap(
  projectId: string,
  actor: AuthUser,
  deviceId: string,
) {
  if (!(await canAccessProjectChat(actor.id, projectId))) {
    throw new ForbiddenError('You are not an explicit member of this project chat');
  }
  await processChatOutbox();
  const room = await AppDataSource.getRepository(ProjectChatRoom).findOne({
    where: { project: { id: projectId } },
  });
  if (!room) throw new NotFoundError('Project chat not found');
  const user = await AppDataSource.getRepository(User).findOne({ where: { id: actor.id } });
  if (!user) throw new NotFoundError('User not found');
  const identity = await ensureMatrixIdentity(user);
  if (!room.matrixRoomId) {
    return {
      status: room.syncStatus,
      error: room.lastError,
      homeserverUrl: env.matrix.publicUrl,
      matrixUserId: identity.matrixUserId,
      roomId: null,
    };
  }
  const login = await loginAs(identity, deviceId);
  return {
    status: room.syncStatus,
    error: room.lastError,
    homeserverUrl: env.matrix.publicUrl,
    matrixUserId: identity.matrixUserId,
    roomId: room.matrixRoomId,
    accessToken: login.accessToken,
    deviceId: login.deviceId,
  };
}

async function identityForActor(actor: AuthUser): Promise<MatrixUserIdentity> {
  const user = await AppDataSource.getRepository(User).findOne({ where: { id: actor.id } });
  if (!user) throw new NotFoundError('User not found');
  return ensureMatrixIdentity(user);
}

export async function listMatrixDevices(actor: AuthUser) {
  const identity = await identityForActor(actor);
  const adminToken = await getAdminToken();
  const result = await matrixRequest<{ devices?: Array<Record<string, unknown>> }>(
    `/_synapse/admin/v2/users/${encodeURIComponent(identity.matrixUserId)}/devices`,
    {},
    adminToken,
  );
  return result.devices ?? [];
}

export async function revokeMatrixDevice(
  actor: AuthUser,
  deviceId: string,
): Promise<void> {
  const identity = await identityForActor(actor);
  const adminToken = await getAdminToken();
  await matrixRequest(
    `/_synapse/admin/v2/users/${encodeURIComponent(identity.matrixUserId)}/devices/${encodeURIComponent(deviceId)}`,
    { method: 'DELETE' },
    adminToken,
  );
}
