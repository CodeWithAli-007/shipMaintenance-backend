import 'reflect-metadata';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
} from './entities/index.js';
import { InitialSchema1740000000000 } from './migrations/1740000000000-InitialSchema.js';
import { AddProjectBackofficeMembers1740000001000 } from './migrations/1740000001000-AddProjectBackofficeMembers.js';
import { DropAdminRole1740000002000 } from './migrations/1740000002000-DropAdminRole.js';
import { RestoreAdminRole1740000003000 } from './migrations/1740000003000-RestoreAdminRole.js';
import { AddProjectPriority1740000004000 } from './migrations/1740000004000-AddProjectPriority.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  ],
  migrations: [
    InitialSchema1740000000000,
    AddProjectBackofficeMembers1740000001000,
    DropAdminRole1740000002000,
    RestoreAdminRole1740000003000,
    AddProjectPriority1740000004000,
  ],
  migrationsTableName: 'typeorm_migrations',
  // Helps TypeORM CLI resolve paths when generating new migrations
  migrationsTransactionMode: 'each',
  extra: {
    max: 20,
  },
});

/** Absolute entities/migrations globs for TypeORM CLI generate (optional) */
export const typeormCliPaths = {
  entitiesDir: path.join(__dirname, 'entities'),
  migrationsDir: path.join(__dirname, 'migrations'),
};
