import { AppDataSource } from '../data-source.js';
import { Finding } from '../entities/Finding.js';
import { ProjectMember } from '../entities/ProjectMember.js';
import { UserRole } from '../entities/enums.js';

/**
 * Project authorization uses snapshotted project_members only —
 * never live team_members.
 */
export async function canAccessProject(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const count = await AppDataSource.getRepository(ProjectMember).count({
    where: {
      project: { id: projectId },
      user: { id: userId },
      active: true,
    },
  });

  return count > 0;
}

export async function canAccessFinding(
  userId: string,
  findingId: string,
): Promise<boolean> {
  const finding = await AppDataSource.getRepository(Finding).findOne({
    where: { id: findingId },
    relations: { project: true },
  });

  if (!finding) {
    return false;
  }

  return canAccessProject(userId, finding.project.id);
}

export function isBackofficeRole(role: UserRole | string): boolean {
  return role === UserRole.BACKOFFICE;
}

export function isAdminRole(role: UserRole | string): boolean {
  return role === UserRole.ADMIN;
}

/** Roles an Admin may create or edit in the Admin portal. */
export const MANAGED_USER_ROLES = [UserRole.BACKOFFICE, UserRole.TECHNICIAN] as const;

export function isManagedUserRole(role: UserRole | string): boolean {
  return (
    role === UserRole.BACKOFFICE || role === UserRole.TECHNICIAN
  );
}
