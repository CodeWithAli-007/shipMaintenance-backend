import type { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../data-source.js';
import { AuthSession } from '../entities/AuthSession.js';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import type { AuthUser } from '../types/index.js';
import { UserRole } from '../entities/enums.js';
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  hashToken,
  parseCookies,
  safeTokenMatches,
} from '../lib/session.js';

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) throw new UnauthorizedError();

    const session = await AppDataSource.getRepository(AuthSession).findOne({
      where: { tokenHash: hashToken(token) },
      relations: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      !session.user.isActive
    ) {
      throw new UnauthorizedError('Invalid or expired session');
    }

    const user: AuthUser = {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      role: session.user.role,
    };

    req.user = user;
    req.authSessionId = session.id;
    req.authCsrfHash = session.csrfHash;
    if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
      session.lastSeenAt = new Date();
      await AppDataSource.getRepository(AuthSession).save(session);
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requireCsrf(req: Request, _res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }
  const csrfCookie = parseCookies(req)[CSRF_COOKIE];
  const csrfHeader = req.header('x-csrf-token');
  const expectedHash = req.authCsrfHash;
  if (
    !csrfCookie ||
    !csrfHeader ||
    csrfCookie !== csrfHeader ||
    !expectedHash ||
    !safeTokenMatches(csrfHeader, expectedHash)
  ) {
    next(new ForbiddenError('Invalid CSRF token'));
    return;
  }
  next();
}

export function requireAuthenticatedMutation(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (
    ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ||
    req.path === '/auth/login'
  ) {
    next();
    return;
  }
  void requireAuth(req, res, (error?: unknown) => {
    if (error) {
      next(error);
      return;
    }
    requireCsrf(req, res, next);
  });
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
