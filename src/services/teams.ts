import { AppDataSource } from '../data-source.js';
import { Team } from '../entities/Team.js';
import { TeamMember } from '../entities/TeamMember.js';
import { User } from '../entities/User.js';
import { EntityStatus, UserRole } from '../entities/enums.js';
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors.js';
import { rethrowUnique } from '../lib/dbErrors.js';

export const MAX_ACTIVE_TEAM_MEMBERS = 5;

export interface TeamInput {
  name: string;
  description: string | null;
  status?: EntityStatus;
}

function toMemberDto(member: TeamMember) {
  return {
    id: member.id,
    active: member.active,
    addedAt: member.addedAt,
    removedAt: member.removedAt,
    user: {
      id: member.user.id,
      fullName: member.user.fullName,
      email: member.user.email,
      role: member.user.role,
    },
  };
}

function toTeamDto(team: Team) {
  const members = (team.members ?? [])
    .slice()
    .sort((a, b) => a.user.fullName.localeCompare(b.user.fullName));
  const activeMembers = members.filter((member) => member.active);

  return {
    id: team.id,
    name: team.name,
    description: team.description,
    status: team.status,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    activeMemberCount: activeMembers.length,
    members: activeMembers.map(toMemberDto),
  };
}

async function loadTeam(id: string) {
  const team = await AppDataSource.getRepository(Team).findOne({
    where: { id },
    relations: { members: { user: true } },
  });
  if (!team) {
    throw new NotFoundError('Team not found');
  }
  return team;
}

export async function listTeams() {
  const teams = await AppDataSource.getRepository(Team).find({
    relations: { members: { user: true } },
    order: { name: 'ASC' },
  });
  return teams.map(toTeamDto);
}

export async function getTeam(id: string) {
  return toTeamDto(await loadTeam(id));
}

export async function createTeam(input: TeamInput, actorId: string) {
  const repo = AppDataSource.getRepository(Team);
  const team = repo.create({
    name: input.name,
    description: input.description,
    status: input.status ?? EntityStatus.ACTIVE,
    createdBy: { id: actorId } as User,
  });

  try {
    const saved = await repo.save(team);
    return getTeam(saved.id);
  } catch (error) {
    rethrowUnique(error, 'A team with this name already exists');
  }
}

export async function updateTeam(id: string, input: Partial<TeamInput>) {
  const repo = AppDataSource.getRepository(Team);
  const team = await repo.findOne({ where: { id } });
  if (!team) {
    throw new NotFoundError('Team not found');
  }

  if (input.name !== undefined) team.name = input.name;
  if (input.description !== undefined) team.description = input.description;
  if (input.status !== undefined) team.status = input.status;

  try {
    await repo.save(team);
  } catch (error) {
    rethrowUnique(error, 'A team with this name already exists');
  }

  return getTeam(id);
}

export async function addTeamMember(teamId: string, userId: string, actorId: string) {
  await AppDataSource.transaction(async (manager) => {
    const team = await manager.findOne(Team, { where: { id: teamId } });
    if (!team) {
      throw new NotFoundError('Team not found');
    }
    if (team.status !== EntityStatus.ACTIVE) {
      throw new ValidationError('Activate the team before adding members');
    }

    const user = await manager.findOne(User, { where: { id: userId } });
    if (!user || !user.isActive || user.role !== UserRole.TECHNICIAN) {
      throw new ValidationError('Select an active technician');
    }

    const existing = await manager.find(TeamMember, {
      where: { team: { id: teamId }, user: { id: userId }, active: true },
    });
    if (existing.length > 0) {
      throw new ConflictError('This technician is already an active team member');
    }

    const activeCount = await manager.count(TeamMember, {
      where: { team: { id: teamId }, active: true },
    });
    if (activeCount >= MAX_ACTIVE_TEAM_MEMBERS) {
      throw new ValidationError(
        `A team can have at most ${MAX_ACTIVE_TEAM_MEMBERS} active members`,
      );
    }

    const member = manager.create(TeamMember, {
      team: { id: teamId } as Team,
      user: { id: userId } as User,
      active: true,
      addedBy: { id: actorId } as User,
    });
    await manager.save(member);
  });

  return getTeam(teamId);
}

export async function removeTeamMember(
  teamId: string,
  userId: string,
  actorId: string,
) {
  await AppDataSource.transaction(async (manager) => {
    const member = await manager.findOne(TeamMember, {
      where: { team: { id: teamId }, user: { id: userId }, active: true },
    });
    if (!member) {
      throw new NotFoundError('Active team membership not found');
    }

    member.active = false;
    member.removedAt = new Date();
    member.removedBy = { id: actorId } as User;
    await manager.save(member);
  });

  return getTeam(teamId);
}
