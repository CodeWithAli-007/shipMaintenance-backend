import { AppDataSource } from '../data-source.js';
import { Project } from '../entities/Project.js';
import { ProjectAssignment } from '../entities/ProjectAssignment.js';
import { ProjectMember } from '../entities/ProjectMember.js';
import { Team } from '../entities/Team.js';
import { TeamMember } from '../entities/TeamMember.js';
import { User } from '../entities/User.js';
import { Vessel } from '../entities/Vessel.js';
import {
  AssignmentType,
  EntityStatus,
  ProjectStatus,
  UserRole,
} from '../entities/enums.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import { isBackofficeRole } from './access.js';
import type { AuthUser } from '../types/index.js';

export interface CreateProjectInput {
  vesselId: string;
  title: string;
  description: string | null;
  notes: string | null;
  mode: 'MANUAL' | 'TEAM';
  technicianIds: string[];
  teamId: string | null;
  additionalTechnicianIds: string[];
}

export interface UpdateProjectInput {
  title?: string;
  description?: string | null;
  notes?: string | null;
  status?: ProjectStatus;
}

function person(user: User | null | undefined) {
  if (!user) return null;
  return { id: user.id, fullName: user.fullName, email: user.email, role: user.role };
}

function toProjectDetail(project: Project) {
  const members = (project.members ?? [])
    .slice()
    .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());

  return {
    id: project.id,
    projectCode: project.projectCode,
    title: project.title,
    description: project.description,
    notes: project.notes,
    status: project.status,
    vesselLocationSnapshot: project.vesselLocationSnapshot,
    startedAt: project.startedAt,
    closedAt: project.closedAt,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    client: {
      id: project.vessel.client.id,
      name: project.vessel.client.name,
    },
    vessel: {
      id: project.vessel.id,
      name: project.vessel.name,
      imoNumber: project.vessel.imoNumber,
      currentLocation: project.vessel.currentLocation,
    },
    createdBy: person(project.createdBy),
    members: members.map((member) => ({
      id: member.id,
      active: member.active,
      sourceType: member.sourceType,
      addedAt: member.addedAt,
      removedAt: member.removedAt,
      user: person(member.user)!,
      sourceTeam: member.sourceTeam
        ? { id: member.sourceTeam.id, name: member.sourceTeam.name }
        : null,
    })),
    assignments: (project.assignments ?? [])
      .slice()
      .sort((a, b) => a.assignedAt.getTime() - b.assignedAt.getTime())
      .map((assignment) => ({
        id: assignment.id,
        assignmentType: assignment.assignmentType,
        active: assignment.active,
        assignedAt: assignment.assignedAt,
        unassignedAt: assignment.unassignedAt,
        team: assignment.team
          ? { id: assignment.team.id, name: assignment.team.name }
          : null,
        assignedBy: person(assignment.assignedBy),
      })),
  };
}

function toProjectListItem(project: Project) {
  const activeMembers = (project.members ?? []).filter((member) => member.active);
  return {
    id: project.id,
    projectCode: project.projectCode,
    title: project.title,
    status: project.status,
    startedAt: project.startedAt,
    createdAt: project.createdAt,
    vesselLocationSnapshot: project.vesselLocationSnapshot,
    client: {
      id: project.vessel.client.id,
      name: project.vessel.client.name,
    },
    vessel: {
      id: project.vessel.id,
      name: project.vessel.name,
    },
    createdBy: person(project.createdBy),
    activeMemberCount: activeMembers.length,
    activeMembers: activeMembers.map((member) => ({
      id: member.user.id,
      fullName: member.user.fullName,
    })),
  };
}

const detailRelations = {
  vessel: { client: true },
  createdBy: true,
  members: { user: true, sourceTeam: true },
  assignments: { team: true, assignedBy: true },
} as const;

async function loadProject(id: string) {
  const project = await AppDataSource.getRepository(Project).findOne({
    where: { id },
    relations: detailRelations,
  });
  if (!project) {
    throw new NotFoundError('Project not found');
  }
  return project;
}

async function assertCanRead(actor: AuthUser, projectId: string) {
  if (isBackofficeRole(actor.role)) {
    return;
  }
  const count = await AppDataSource.getRepository(ProjectMember).count({
    where: {
      project: { id: projectId },
      user: { id: actor.id },
      active: true,
    },
  });
  if (count === 0) {
    throw new ForbiddenError('No active project membership');
  }
}

async function requireTechnicians(manager: typeof AppDataSource.manager, ids: string[]) {
  if (ids.length === 0) {
    return [];
  }
  const users = await manager.find(User, {
    where: ids.map((id) => ({ id })),
  });
  const byId = new Map(users.map((user) => [user.id, user]));
  for (const id of ids) {
    const user = byId.get(id);
    if (!user || !user.isActive || user.role !== UserRole.TECHNICIAN) {
      throw new ValidationError('Every assigned person must be an active technician');
    }
  }
  return ids;
}

async function nextProjectCode(manager: typeof AppDataSource.manager) {
  const rows = (await manager.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(project_code FROM 5) AS INTEGER)), 0)::int AS n
     FROM projects
     WHERE project_code ~ '^PJI-[0-9]+$'`,
  )) as Array<{ n: number }>;
  const next = Number(rows[0]?.n ?? 0) + 1;
  return `PJI-${String(next).padStart(4, '0')}`;
}

export async function listProjects(actor: AuthUser) {
  const repo = AppDataSource.getRepository(Project);
  if (isBackofficeRole(actor.role)) {
    const projects = await repo.find({
      relations: {
        vessel: { client: true },
        createdBy: true,
        members: { user: true },
      },
      order: { createdAt: 'DESC' },
    });
    return projects.map(toProjectListItem);
  }

  const memberships = await AppDataSource.getRepository(ProjectMember).find({
    where: { user: { id: actor.id }, active: true },
    relations: {
      project: {
        vessel: { client: true },
        createdBy: true,
        members: { user: true },
      },
    },
  });

  return memberships
    .map((membership) => membership.project)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(toProjectListItem);
}

export async function getProject(id: string, actor: AuthUser) {
  await assertCanRead(actor, id);
  return toProjectDetail(await loadProject(id));
}

export async function createProject(input: CreateProjectInput, actor: AuthUser) {
  if (!isBackofficeRole(actor.role)) {
    throw new ForbiddenError('Only backoffice can create projects');
  }

  const projectId = await AppDataSource.transaction(async (manager) => {
    const vessel = await manager.findOne(Vessel, {
      where: { id: input.vesselId },
      relations: { client: true },
    });
    if (!vessel) {
      throw new NotFoundError('Vessel not found');
    }
    if (vessel.status !== EntityStatus.ACTIVE) {
      throw new ValidationError('Select an active vessel');
    }
    if (vessel.client.status !== EntityStatus.ACTIVE) {
      throw new ValidationError('The vessel client must be active');
    }

    const technicianIds = [...new Set(input.technicianIds)];
    const additionalIds = [...new Set(input.additionalTechnicianIds)];

    let team: Team | null = null;
    let snapshotUserIds: string[] = [];

    if (input.mode === 'TEAM') {
      if (!input.teamId) {
        throw new ValidationError('Select a team');
      }
      team = await manager.findOne(Team, { where: { id: input.teamId } });
      if (!team) {
        throw new NotFoundError('Team not found');
      }
      if (team.status !== EntityStatus.ACTIVE) {
        throw new ValidationError('Select an active team');
      }

      const teamMembers = await manager.find(TeamMember, {
        where: { team: { id: team.id }, active: true },
        relations: { user: true },
      });
      snapshotUserIds = teamMembers
        .filter((member) => member.user.isActive && member.user.role === UserRole.TECHNICIAN)
        .map((member) => member.user.id);
    }

    const manualIds =
      input.mode === 'MANUAL'
        ? technicianIds
        : additionalIds.filter((id) => !snapshotUserIds.includes(id));

    await requireTechnicians(manager, manualIds);

    const memberIds =
      input.mode === 'MANUAL' ? manualIds : [...snapshotUserIds, ...manualIds];

    if (memberIds.length === 0) {
      throw new ValidationError('Assign at least one technician');
    }

    const project = manager.create(Project, {
      vessel,
      projectCode: await nextProjectCode(manager),
      title: input.title,
      description: input.description,
      notes: input.notes,
      vesselLocationSnapshot: vessel.currentLocation,
      status: ProjectStatus.OPEN,
      createdBy: { id: actor.id } as User,
      startedAt: new Date(),
    });
    await manager.save(project);

    const manualAssignment =
      manualIds.length > 0
        ? await manager.save(
            manager.create(ProjectAssignment, {
              project,
              assignmentType: AssignmentType.MANUAL,
              team: null,
              active: true,
              assignedBy: { id: actor.id } as User,
            }),
          )
        : null;

    const teamAssignment = team
      ? await manager.save(
          manager.create(ProjectAssignment, {
            project,
            assignmentType: AssignmentType.TEAM,
            team,
            active: true,
            assignedBy: { id: actor.id } as User,
          }),
        )
      : null;

    for (const userId of snapshotUserIds) {
      await manager.save(
        manager.create(ProjectMember, {
          project,
          user: { id: userId } as User,
          projectAssignment: teamAssignment,
          sourceType: AssignmentType.TEAM,
          sourceTeam: team,
          active: true,
          addedBy: { id: actor.id } as User,
        }),
      );
    }

    for (const userId of manualIds) {
      await manager.save(
        manager.create(ProjectMember, {
          project,
          user: { id: userId } as User,
          projectAssignment: manualAssignment,
          sourceType: AssignmentType.MANUAL,
          sourceTeam: null,
          active: true,
          addedBy: { id: actor.id } as User,
        }),
      );
    }

    return project.id;
  });

  return getProject(projectId, actor);
}

export async function updateProject(
  id: string,
  input: UpdateProjectInput,
  actor: AuthUser,
) {
  if (!isBackofficeRole(actor.role)) {
    throw new ForbiddenError('Only backoffice can edit projects');
  }

  const repo = AppDataSource.getRepository(Project);
  const project = await repo.findOne({ where: { id } });
  if (!project) {
    throw new NotFoundError('Project not found');
  }

  if (input.title !== undefined) project.title = input.title;
  if (input.description !== undefined) project.description = input.description;
  if (input.notes !== undefined) project.notes = input.notes;
  if (input.status !== undefined) {
    project.status = input.status;
    if (input.status === ProjectStatus.CLOSED || input.status === ProjectStatus.COMPLETED) {
      project.closedAt = project.closedAt ?? new Date();
    }
  }

  await repo.save(project);
  return getProject(id, actor);
}

export async function addProjectMember(projectId: string, userId: string, actor: AuthUser) {
  if (!isBackofficeRole(actor.role)) {
    throw new ForbiddenError('Only backoffice can change project members');
  }

  await AppDataSource.transaction(async (manager) => {
    const project = await manager.findOne(Project, { where: { id: projectId } });
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    await requireTechnicians(manager, [userId]);

    const existing = await manager.findOne(ProjectMember, {
      where: { project: { id: projectId }, user: { id: userId }, active: true },
    });
    if (existing) {
      throw new ConflictError('This technician already has access to the project');
    }

    const assignment = await manager.save(
      manager.create(ProjectAssignment, {
        project,
        assignmentType: AssignmentType.MANUAL,
        team: null,
        active: true,
        assignedBy: { id: actor.id } as User,
      }),
    );

    await manager.save(
      manager.create(ProjectMember, {
        project,
        user: { id: userId } as User,
        projectAssignment: assignment,
        sourceType: AssignmentType.MANUAL,
        sourceTeam: null,
        active: true,
        addedBy: { id: actor.id } as User,
      }),
    );
  });

  return getProject(projectId, actor);
}

export async function removeProjectMember(
  projectId: string,
  userId: string,
  actor: AuthUser,
) {
  if (!isBackofficeRole(actor.role)) {
    throw new ForbiddenError('Only backoffice can change project members');
  }

  await AppDataSource.transaction(async (manager) => {
    const member = await manager.findOne(ProjectMember, {
      where: { project: { id: projectId }, user: { id: userId }, active: true },
    });
    if (!member) {
      throw new NotFoundError('Active project membership not found');
    }

    member.active = false;
    member.removedAt = new Date();
    member.removedBy = { id: actor.id } as User;
    await manager.save(member);
  });

  return getProject(projectId, actor);
}
