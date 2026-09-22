import { AppDataSource } from '../data-source.js';
import { User } from '../entities/User.js';
import { UserRole } from '../entities/enums.js';

export async function listUsers(role?: UserRole) {
  const users = await AppDataSource.getRepository(User).find({
    where: role ? { role, isActive: true } : { isActive: true },
    order: { fullName: 'ASC' },
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
  }));
}
