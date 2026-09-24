import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';

export const SESSION_COOKIE = 'shipmaintenance_session';
export const CSRF_COOKIE = 'shipmaintenance_csrf';

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function safeTokenMatches(value: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(value), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function parseCookies(req: Request): Record<string, string> {
  const header = req.header('cookie');
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').flatMap((part) => {
      const index = part.indexOf('=');
      if (index < 1) return [];
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      try {
        return [[key, decodeURIComponent(value)]];
      } catch {
        return [];
      }
    }),
  );
}

function cookieBase(maxAgeSeconds: number): string {
  const secure = env.isProduction ? '; Secure' : '';
  return `Path=/; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`;
}

export function setSessionCookies(
  res: Response,
  sessionToken: string,
  csrfToken: string,
): void {
  const maxAge = env.sessionTtlHours * 60 * 60;
  res.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}; HttpOnly; ${cookieBase(maxAge)}`,
  );
  res.append(
    'Set-Cookie',
    `${CSRF_COOKIE}=${encodeURIComponent(csrfToken)}; ${cookieBase(maxAge)}`,
  );
}

export function clearSessionCookies(res: Response): void {
  const secure = env.isProduction ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
  );
  res.append(
    'Set-Cookie',
    `${CSRF_COOKIE}=; Path=/; SameSite=Strict; Max-Age=0${secure}`,
  );
}
