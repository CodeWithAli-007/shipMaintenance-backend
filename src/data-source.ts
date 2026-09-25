import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from './config/env.js';
import {
  User,
  Client,
  Vessel,
  Team,
  TeamMember,
  Project,
  ProjectAssignment,
  ProjectMember,
  ProjectBackofficeMember,
  Finding,
  FindingUpdate,
  MediaAsset,
  FindingAttachment,
  FindingComment,
  AuthSession,
  MatrixUserIdentity,
  ProjectChatRoom,
  ChatMembershipOutbox,
} from './entities/index.js';
import { InitialSchema1740000000000 } from './migrations/1740000000000-InitialSchema.js';
import { AddProjectBackofficeMembers1740000001000 } from './migrations/1740000001000-AddProjectBackofficeMembers.js';
import { DropAdminRole1740000002000 } from './migrations/1740000002000-DropAdminRole.js';
import { RestoreAdminRole1740000003000 } from './migrations/1740000003000-RestoreAdminRole.js';
import { AddProjectPriority1740000004000 } from './migrations/1740000004000-AddProjectPriority.js';
import { AddAuthSessions1740000005000 } from './migrations/1740000005000-AddAuthSessions.js';
import { AddEncryptedProjectChat1740000006000 } from './migrations/1740000006000-AddEncryptedProjectChat.js';
import { AddMediaExpiry1740000007000 } from './migrations/1740000007000-AddMediaExpiry.js';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.postgres.host,
  port: env.postgres.port,
  username: env.postgres.username,
  password: env.postgres.password,
  database: env.postgres.database,
  synchronize: false,
  logging: env.isDevelopment ? ['error', 'warn', 'migration'] : ['error'],
  entities: [
    User,
    Client,
    Vessel,
    Team,
    TeamMember,
    Project,
    ProjectAssignment,
    ProjectMember,
    ProjectBackofficeMember,
    Finding,
    FindingUpdate,
    MediaAsset,
    FindingAttachment,
    FindingComment,
    AuthSession,
    MatrixUserIdentity,
    ProjectChatRoom,
    ChatMembershipOutbox,
  ],
  migrations: [
    InitialSchema1740000000000,
    AddProjectBackofficeMembers1740000001000,
    DropAdminRole1740000002000,
    RestoreAdminRole1740000003000,
    AddProjectPriority1740000004000,
    AddAuthSessions1740000005000,
    AddEncryptedProjectChat1740000006000,
    AddMediaExpiry1740000007000,
  ],
  migrationsTableName: 'typeorm_migrations',
  // Helps TypeORM CLI resolve paths when generating new migrations
  migrationsTransactionMode: 'each',
  extra: {
    max: 20,
  },
});

