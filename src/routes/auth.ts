import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { loginBody } from './schemas.js';
import { asyncHandler, parseInput } from '../lib/http.js';
import { loginWithPassword, revokeSession } from '../services/auth.js';
import { requireAuth } from '../middleware/auth.js';
import {
  SESSION_COOKIE,
  CSRF_COOKIE,
  clearSessionCookies,
  parseCookies,
  setSessionCookies,
  safeTokenMatches,
} from '../lib/session.js';
import { ForbiddenError } from '../lib/errors.js';

export const authRouter = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { message: 'Too many login attempts. Try again later.' } },
});

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = parseInput(loginBody, req.body);
    const result = await loginWithPassword(body.email, body.password, {
      userAgent: req.header('user-agent'),
      ipAddress: req.ip,
    });
    setSessionCookies(res, result.sessionToken, result.csrfToken);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ user: result.user, csrfToken: result.csrfToken });
  }),
);

authRouter.get(
  '/csrf',
  requireAuth,
  (req, res) => {
    // Native clients share the cookie jar but cannot read document.cookie.
    const csrfToken = parseCookies(req)[CSRF_COOKIE];
    if (!csrfToken || !req.authCsrfHash || !safeTokenMatches(csrfToken, req.authCsrfHash)) {
      throw new ForbiddenError('Invalid CSRF token');
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ csrfToken });
  },
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const csrfToken = parseCookies(req)[CSRF_COOKIE];
    res.setHeader('Cache-Control', 'no-store');
    res.json({ user: req.user, csrfToken: csrfToken && req.authCsrfHash && safeTokenMatches(csrfToken, req.authCsrfHash) ? csrfToken : undefined });
  }),
);

authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    await revokeSession(parseCookies(req)[SESSION_COOKIE]);
    clearSessionCookies(res);
    res.status(204).end();
  }),
);
