import { AppDataSource } from '../data-source.js';
import { User } from '../entities/User.js';
import { UserRole } from '../entities/enums.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import { rethrowUnique } from '../lib/dbErrors.js';
import { hashPassword } from '../lib/password.js';
import { isManagedUserRole } from './access.js';

export interface ManagedUserInput {
  email: string;
  fullName: string;
  role: UserRole.BACKOFFICE | UserRole.TECHNICIAN;
  password?: string;
  isActive?: boolean;
}

function toUserDto(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function assertManagedRole(role: UserRole) {
  if (!isManagedUserRole(role)) {
    throw new ValidationError('Admin can only manage Backoffice and Technician users');
  }
}

export async function listManagedUsers(filters?: {
  role?: UserRole;
  includeInactive?: boolean;
}) {
  const repo = AppDataSource.getRepository(User);
  const qb = repo
    .createQueryBuilder('user')
    .where('user.role IN (:...roles)', {
      roles: [UserRole.BACKOFFICE, UserRole.TECHNICIAN],
    })
    .orderBy('user.fullName', 'ASC');

  if (filters?.role) {
    assertManagedRole(filters.role);
    qb.andWhere('user.role = :role', { role: filters.role });
  }

  if (!filters?.includeInactive) {
    qb.andWhere('user.isActive = TRUE');
  }

  const users = await qb.getMany();
  return users.map(toUserDto);
}

export async function getManagedUser(id: string) {
  const user = await AppDataSource.getRepository(User).findOne({ where: { id } });
  if (!user || !isManagedUserRole(user.role)) {
    throw new NotFoundError('User not found');
  }
  return toUserDto(user);
}

export async function createManagedUser(input: ManagedUserInput) {
  assertManagedRole(input.role);
  if (!input.password || input.password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters');
  }

  const repo = AppDataSource.getRepository(User);
  const user = repo.create({
    email: input.email.toLowerCase().trim(),
    fullName: input.fullName.trim(),
    role: input.role,
    passwordHash: await hashPassword(input.password),
    isActive: input.isActive ?? true,
  });

  try {
    const saved = await repo.save(user);
    return toUserDto(saved);
  } catch (error) {
    rethrowUnique(error, 'A user with this email already exists');
  }
}

export async function updateManagedUser(id: string, input: Partial<ManagedUserInput>) {
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOne({ where: { id } });
  if (!user || !isManagedUserRole(user.role)) {
    throw new NotFoundError('User not found');
  }

  if (input.role !== undefined) {
    assertManagedRole(input.role);
    user.role = input.role;
  }
  if (input.email !== undefined) {
    user.email = input.email.toLowerCase().trim();
  }
  if (input.fullName !== undefined) {
    user.fullName = input.fullName.trim();
  }
  if (input.isActive !== undefined) {
    user.isActive = input.isActive;
  }
  if (input.password !== undefined && input.password.length > 0) {
    if (input.password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters');
    }
    user.passwordHash = await hashPassword(input.password);
  }

  try {
    await repo.save(user);
  } catch (error) {
    rethrowUnique(error, 'A user with this email already exists');
  }

  return getManagedUser(id);
}

/** Soft-delete: deactivate the account. Admin accounts cannot be removed here. */
export async function deleteManagedUser(id: string, actorId: string) {
  if (id === actorId) {
    throw new ForbiddenError('You cannot delete your own account');
  }

  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOne({ where: { id } });
  if (!user || !isManagedUserRole(user.role)) {
    throw new NotFoundError('User not found');
  }

  user.isActive = false;
  await repo.save(user);
  return toUserDto(user);
}

export async function listUsers(role?: UserRole) {
  const users = await AppDataSource.getRepository(User).find({
    where: role ? { role, isActive: true } : { isActive: true },
    order: { fullName: 'ASC' },
  });

  return users
    .filter((user) => user.role !== UserRole.ADMIN)
    .map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
    }));
}
