import { AppDataSource } from '../data-source.js';
import { User } from '../entities/User.js';
import { UnauthorizedError } from '../lib/errors.js';
import { verifyPassword } from '../lib/password.js';
import type { AuthUser } from '../types/index.js';

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  const user = await AppDataSource.getRepository(User).findOne({
    where: { email: email.toLowerCase() },
  });

  if (!user || !user.isActive || !user.passwordHash) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const matches = await verifyPassword(password, user.passwordHash);
  if (!matches) {
    throw new UnauthorizedError('Invalid email or password');
  }

  return {
    token: user.id,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  };
}
