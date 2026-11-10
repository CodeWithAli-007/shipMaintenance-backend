import 'reflect-metadata';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { In } from 'typeorm';
import { AppDataSource } from '../data-source.js';
import { Client } from '../entities/Client.js';
import { Vessel } from '../entities/Vessel.js';
import { Project } from '../entities/Project.js';
import { ProjectMember } from '../entities/ProjectMember.js';
import { Finding } from '../entities/Finding.js';
import { FindingUpdate } from '../entities/FindingUpdate.js';
import { FindingComment } from '../entities/FindingComment.js';
import { FindingAttachment } from '../entities/FindingAttachment.js';
import { MediaAsset } from '../entities/MediaAsset.js';
import { User } from '../entities/User.js';
import {
  AssignmentType,
  CommentVisibility,
  FindingSeverity,
  FindingStatus,
  MediaType,
  ProjectPriority,
  ProjectStatus,
} from '../entities/enums.js';
import { storage } from '../storage/provider.js';

const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../demo-data/engine-issue');
const CLIENT_CODE = 'DEMO-NORDIC';
const VESSEL_IMO = '9876543';
const PROJECT_CODE = 'PRJ-DEMO-AE2';

interface DemoMessage {
  id: string;
  author: string;
  visibility: 'TECHNICIAN_VISIBLE' | 'INTERNAL';
  createdAt: string;
  body: string;
  attachments: string[];
}

interface DemoData {
  finding: {
    title: string;
    description: string;
    severity: FindingSeverity;
    status: FindingStatus;
    equipmentName: string;
    equipmentModel: string;
    equipmentLocation: string;
    createdBy: string;
    createdAt: string;
  };
  statusTimeline: Array<{ status: FindingStatus; at: string }>;
  messages: DemoMessage[];
}

async function seedEngineIssue(): Promise<void> {
  const data = JSON.parse(await readFile(resolve(DATA_DIR, 'conversation.json'), 'utf8')) as DemoData;
  await AppDataSource.initialize();

  const emails = [...new Set([data.finding.createdBy, ...data.messages.map((m) => m.author)])];
  const users = await AppDataSource.getRepository(User).find({ where: { email: In(emails) } });
  const byEmail = new Map(users.map((u) => [u.email, u]));
  const missing = emails.filter((e) => !byEmail.has(e));
  if (missing.length) throw new Error(`Missing users (run npm run seed first): ${missing.join(', ')}`);
  const office = byEmail.get('emma.weber@ship.local')!;
  const creator = byEmail.get(data.finding.createdBy)!;

  const existingProject = await AppDataSource.getRepository(Project).findOne({ where: { projectCode: PROJECT_CODE } });
  if (existingProject && await AppDataSource.getRepository(Finding).exists({ where: { project: { id: existingProject.id }, title: data.finding.title } })) {
    console.log(`Finding already imported in ${PROJECT_CODE}; nothing to do.`);
    return;
  }

  const written: string[] = [];
  try {
    await AppDataSource.transaction(async (manager) => {
      const client = (await manager.findOne(Client, { where: { clientCode: CLIENT_CODE } })) ??
        await manager.save(Client, manager.create(Client, {
          name: 'Nordic Star Shipping GmbH', clientCode: CLIENT_CODE, city: 'Hamburg', country: 'Germany',
          email: 'technical@nordicstar.example', createdBy: office,
        }));

      const vessel = (await manager.findOne(Vessel, { where: { imoNumber: VESSEL_IMO } })) ??
        await manager.save(Vessel, manager.create(Vessel, {
          client, name: 'MV Nordic Star', imoNumber: VESSEL_IMO, vesselType: 'Container ship',
          currentLocation: 'Anchorage, Port of Rotterdam', createdBy: office,
        }));

      const project = existingProject ?? await manager.save(Project, manager.create(Project, {
        vessel, projectCode: PROJECT_CODE, title: 'AE2 generator troubleshooting',
        description: 'Auxiliary engine No. 2 – combustion issue on cylinder 4.',
        vesselLocationSnapshot: vessel.currentLocation, status: ProjectStatus.IN_PROGRESS,
        priority: ProjectPriority.HIGH, createdBy: office, startedAt: new Date(data.finding.createdAt),
      }));

      const activeMembers = await manager.find(ProjectMember, { where: { project: { id: project.id }, active: true }, relations: { user: true } });
      const memberIds = new Set(activeMembers.map((m) => m.user.id));
      for (const user of users) {
        if (memberIds.has(user.id)) continue;
        await manager.save(ProjectMember, manager.create(ProjectMember, {
          project, user, sourceType: AssignmentType.MANUAL, active: true, addedBy: office,
        }));
      }

      const rows = (await manager.query(
        `SELECT COALESCE(MAX(finding_number), 0)::int AS n FROM findings WHERE project_id = $1`,
        [project.id],
      )) as Array<{ n: number }>;
      const finalStatus = data.statusTimeline.at(-1)!;
      const finding = await manager.save(Finding, manager.create(Finding, {
        project,
        findingNumber: Number(rows[0]?.n ?? 0) + 1,
        title: data.finding.title,
        description: data.finding.description,
        severity: data.finding.severity,
        status: finalStatus.status,
        equipmentName: data.finding.equipmentName,
        equipmentModel: data.finding.equipmentModel,
        equipmentLocation: data.finding.equipmentLocation,
        createdBy: creator,
        closedAt: finalStatus.status === FindingStatus.CLOSED ? new Date(finalStatus.at) : null,
      }));

      for (const message of data.messages) {
        const author = byEmail.get(message.author)!;
        const at = new Date(message.createdAt);
        if (message.visibility === 'INTERNAL') {
          const comment = await manager.save(FindingComment, manager.create(FindingComment, {
            finding, user: author, comment: message.body, visibility: CommentVisibility.INTERNAL,
          }));
          await manager.query(`UPDATE finding_comments SET created_at = $1, updated_at = $1 WHERE id = $2`, [at, comment.id]);
          continue;
        }

        const update = await manager.save(FindingUpdate, manager.create(FindingUpdate, {
          finding, createdBy: author, note: message.body,
        }));
        await manager.query(`UPDATE finding_updates SET created_at = $1, updated_at = $1 WHERE id = $2`, [at, update.id]);

        for (const [index, file] of message.attachments.entries()) {
          const bytes = await readFile(resolve(DATA_DIR, file));
          const key = randomUUID();
          await storage.uploadFile(key, bytes);
          written.push(key);
          const asset = await manager.save(MediaAsset, manager.create(MediaAsset, {
            uploadedBy: author, mediaType: MediaType.IMAGE, originalFilename: basename(file), mimeType: 'image/jpeg',
            storageProvider: storage.name, storageKey: key, fileSizeBytes: String(bytes.length), metadata: {},
            contentHash: createHash('sha256').update(bytes).digest('hex'), expiresAt: null,
          }));
          const link = await manager.save(FindingAttachment, manager.create(FindingAttachment, {
            finding, findingUpdate: update, mediaAsset: asset, sortOrder: index,
          }));
          await manager.query(`UPDATE media_assets SET created_at = $1 WHERE id = $2`, [at, asset.id]);
          await manager.query(`UPDATE finding_attachments SET created_at = $1 WHERE id = $2`, [at, link.id]);
        }
      }

      const lastAt = new Date(data.messages.at(-1)!.createdAt);
      await manager.query(`UPDATE findings SET created_at = $1, updated_at = $2 WHERE id = $3`, [new Date(data.finding.createdAt), lastAt, finding.id]);
      console.log(`Imported finding #${finding.findingNumber} into ${PROJECT_CODE} (${data.messages.length} messages, ${written.length} images).`);
    });
  } catch (error) {
    await Promise.allSettled(written.map((key) => storage.deleteFile(key)));
    throw error;
  }
}

seedEngineIssue()
  .then(async () => {
    await AppDataSource.destroy();
  })
  .catch(async (error) => {
    console.error('Engine issue seed failed:', error);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exitCode = 1;
  });
