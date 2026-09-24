import { AppDataSource } from '../data-source.js';
import { User } from '../entities/User.js';
import { AuthSession } from '../entities/AuthSession.js';
import { UnauthorizedError } from '../lib/errors.js';
import { verifyPassword } from '../lib/password.js';
import type { AuthUser } from '../types/index.js';
import { env } from '../config/env.js';
import { hashToken, randomToken } from '../lib/session.js';

export async function loginWithPassword(
  email: string,
  password: string,
  context: { userAgent?: string; ipAddress?: string },
): Promise<{ sessionToken: string; csrfToken: string; user: AuthUser }> {
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

  const sessionToken = randomToken();
  const csrfToken = randomToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.sessionTtlHours * 60 * 60 * 1000);
  await AppDataSource.getRepository(AuthSession).save(
    AppDataSource.getRepository(AuthSession).create({
      user,
      tokenHash: hashToken(sessionToken),
      csrfHash: hashToken(csrfToken),
      userAgent: context.userAgent?.slice(0, 512) ?? null,
      ipAddress: context.ipAddress?.slice(0, 64) ?? null,
      expiresAt,
      lastSeenAt: now,
      revokedAt: null,
    }),
  );

  return {
    sessionToken,
    csrfToken,
    user: toAuthUser(user),
  };
}

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  const repo = AppDataSource.getRepository(AuthSession);
  const session = await repo.findOne({ where: { tokenHash: hashToken(token) } });
  if (!session || session.revokedAt) return;
  session.revokedAt = new Date();
  await repo.save(session);
}
