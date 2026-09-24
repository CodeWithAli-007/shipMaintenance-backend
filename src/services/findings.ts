import { AppDataSource } from '../data-source.js';
import { Finding } from '../entities/Finding.js';
import { FindingUpdate } from '../entities/FindingUpdate.js';
import { Project } from '../entities/Project.js';
import { User } from '../entities/User.js';
import { CommentVisibility, FindingSeverity, FindingStatus, ProjectStatus } from '../entities/enums.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import { canAccessProject, isBackofficeRole } from './access.js';
import type { AuthUser } from '../types/index.js';

export interface CreateFindingInput {
  title: string | null;
  description: string;
  severity: FindingSeverity;
  equipmentName: string | null;
  equipmentModel: string | null;
  equipmentLocation: string | null;
}

export interface UpdateFindingInput {
  title?: string | null;
  description?: string;
  severity?: FindingSeverity;
  status?: FindingStatus;
  equipmentName?: string | null;
  equipmentModel?: string | null;
  equipmentLocation?: string | null;
}

function person(user: User | null | undefined) {
  if (!user) return null;
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
  };
}

async function assertProjectAccess(actor: AuthUser, projectId: string) {
  if (isBackofficeRole(actor.role)) {
    return;
  }
  if (!(await canAccessProject(actor.id, projectId))) {
    throw new ForbiddenError('No active project membership');
  }
}

function toFindingListItem(finding: Finding) {
  const updates = finding.updates ?? [];
  const latestUpdate = updates
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  return {
    id: finding.id,
    findingNumber: finding.findingNumber,
    title: finding.title,
    description: finding.description,
    severity: finding.severity,
    status: finding.status,
    equipmentName: finding.equipmentName,
    equipmentModel: finding.equipmentModel,
    equipmentLocation: finding.equipmentLocation,
    createdAt: finding.createdAt,
    updatedAt: finding.updatedAt,
    closedAt: finding.closedAt,
    createdBy: person(finding.createdBy),
    updateCount: updates.length,
    latestActivityAt: latestUpdate?.createdAt ?? finding.updatedAt,
  };
}

function toFindingDetail(finding: Finding, actor: AuthUser) {
  const media = (finding.attachments ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime())
    .map(link => ({
    id: link.mediaAsset.id, name: link.mediaAsset.originalFilename,
    type: link.mediaAsset.mediaType, mimeType: link.mediaAsset.mimeType,
    size: Number(link.mediaAsset.fileSizeBytes ?? 0), createdAt: link.createdAt,
    expiresAt: link.mediaAsset.expiresAt,
    updateId: link.findingUpdate?.id ?? null,
  }));
  const updates = (finding.updates ?? [])
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const activity = [
    {
      id: `observation-${finding.id}`,
      kind: 'OBSERVATION' as const,
      note: finding.description,
      createdAt: finding.createdAt,
      createdBy: person(finding.createdBy),
    },
    ...updates.map((update) => ({
      id: update.id,
      kind: 'UPDATE' as const,
      note: update.note,
      createdAt: update.createdAt,
      createdBy: person(update.createdBy),
    })),
    ...(finding.comments ?? []).filter(comment => comment.visibility !== CommentVisibility.INTERNAL || isBackofficeRole(actor.role)).map(comment => ({
      id: comment.id, kind: 'COMMENT' as const, note: comment.comment,
      createdAt: comment.createdAt, createdBy: person(comment.user), visibility: comment.visibility,
    })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return {
    ...toFindingListItem(finding),
    project: {
      id: finding.project.id,
      projectCode: finding.project.projectCode,
      title: finding.project.title,
      status: finding.project.status,
      client: {
        id: finding.project.vessel.client.id,
        name: finding.project.vessel.client.name,
      },
      vessel: {
        id: finding.project.vessel.id,
        name: finding.project.vessel.name,
      },
    },
    updates: updates.map((update) => ({
      id: update.id,
      note: update.note,
      createdAt: update.createdAt,
      updatedAt: update.updatedAt,
      createdBy: person(update.createdBy),
    })),
    activity,
    media,
  };
}

async function loadFinding(id: string) {
  const finding = await AppDataSource.getRepository(Finding).findOne({
    where: { id },
    relations: {
      createdBy: true,
      updates: { createdBy: true },
      attachments: { mediaAsset: true, findingUpdate: true },
      comments: { user: true },
      project: { vessel: { client: true } },
    },
  });
  if (!finding) {
    throw new NotFoundError('Finding not found');
  }
  return finding;
}

export async function listProjectFindings(projectId: string, actor: AuthUser) {
  await assertProjectAccess(actor, projectId);

  const project = await AppDataSource.getRepository(Project).findOne({
    where: { id: projectId },
  });
  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const findings = await AppDataSource.getRepository(Finding).find({
    where: { project: { id: projectId } },
    relations: { createdBy: true, updates: true },
    order: { findingNumber: 'ASC' },
  });

  return findings.map(toFindingListItem);
}

export async function getFinding(id: string, actor: AuthUser) {
  const finding = await loadFinding(id);
  await assertProjectAccess(actor, finding.project.id);
  return toFindingDetail(finding, actor);
}

export async function createFinding(
  projectId: string,
  input: CreateFindingInput,
  actor: AuthUser,
) {
  await assertProjectAccess(actor, projectId);

  const findingId = await AppDataSource.transaction(async (manager) => {
    const project = await manager.findOne(Project, { where: { id: projectId } });
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const rows = (await manager.query(
      `SELECT COALESCE(MAX(finding_number), 0)::int AS n FROM findings WHERE project_id = $1`,
      [projectId],
    )) as Array<{ n: number }>;
    const findingNumber = Number(rows[0]?.n ?? 0) + 1;

    const description = input.description.trim();
    if (!description) {
      throw new ValidationError('Initial observation is required');
    }

    const finding = manager.create(Finding, {
      project,
      findingNumber,
      title: input.title,
      description,
      severity: input.severity,
      status: FindingStatus.OPEN,
      equipmentName: input.equipmentName,
      equipmentModel: input.equipmentModel,
      equipmentLocation: input.equipmentLocation,
      createdBy: { id: actor.id } as User,
    });
    await manager.save(finding);

    if (project.status === ProjectStatus.OPEN) {
      project.status = ProjectStatus.IN_PROGRESS;
      if (!project.startedAt) {
        project.startedAt = new Date();
      }
      await manager.save(project);
    }

    return finding.id;
  });

  return getFinding(findingId, actor);
}

export async function updateFinding(
  id: string,
  input: UpdateFindingInput,
  actor: AuthUser,
) {
  const existing = await loadFinding(id);
  await assertProjectAccess(actor, existing.project.id);

  const repo = AppDataSource.getRepository(Finding);
  const finding = await repo.findOne({ where: { id } });
  if (!finding) {
    throw new NotFoundError('Finding not found');
  }

  if (input.title !== undefined) finding.title = input.title;
  if (input.description !== undefined) {
    const description = input.description.trim();
    if (!description) {
      throw new ValidationError('Initial observation cannot be empty');
    }
    finding.description = description;
  }
  if (input.severity !== undefined) finding.severity = input.severity;
  if (input.status !== undefined) {
    finding.status = input.status;
    finding.closedAt =
      input.status === FindingStatus.CLOSED ? (finding.closedAt ?? new Date()) : null;
  }
  if (input.equipmentName !== undefined) finding.equipmentName = input.equipmentName;
  if (input.equipmentModel !== undefined) finding.equipmentModel = input.equipmentModel;
  if (input.equipmentLocation !== undefined) {
    finding.equipmentLocation = input.equipmentLocation;
  }

  await repo.save(finding);
  return getFinding(id, actor);
}

export async function addFindingUpdate(
  findingId: string,
  note: string,
  actor: AuthUser,
) {
  const finding = await loadFinding(findingId);
  await assertProjectAccess(actor, finding.project.id);

  const text = note.trim();
  if (!text) {
    throw new ValidationError('Update note is required');
  }

  const repo = AppDataSource.getRepository(FindingUpdate);
  await repo.save(
    repo.create({
      finding: { id: findingId } as Finding,
      note: text,
      createdBy: { id: actor.id } as User,
    }),
  );

  finding.updatedAt = new Date();
  await AppDataSource.getRepository(Finding).save(finding);

  return getFinding(findingId, actor);
}
