import type { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../data-source.js';
import { env } from '../config/env.js';
import { User } from '../entities/User.js';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import type { AuthUser } from '../types/index.js';
import { UserRole } from '../entities/enums.js';

/**
 * MVP auth placeholder.
 * Prefer Authorization: Bearer <user-uuid> in development, or DEV_AUTH_USER_ID.
 * Replace with session + email 2FA middleware when integrating existing auth.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.header('authorization');
    const bearerId = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : undefined;
    const userId = bearerId || env.devAuthUserId;

    if (!userId) {
      throw new UnauthorizedError(
        'Provide Authorization: Bearer <user-id> or set DEV_AUTH_USER_ID',
      );
    }

    const userEntity = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
    });

    if (!userEntity || !userEntity.isActive) {
      throw new UnauthorizedError('Invalid or inactive user');
    }

    const user: AuthUser = {
      id: userEntity.id,
      email: userEntity.email,
      fullName: userEntity.fullName,
      role: userEntity.role,
    };

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('Insufficient role'));
      return;
    }

    next();
  };
}
