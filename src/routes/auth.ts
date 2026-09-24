import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { loginBody } from './schemas.js';
import { asyncHandler, parseInput } from '../lib/http.js';
import { loginWithPassword, revokeSession } from '../services/auth.js';
import { requireAuth } from '../middleware/auth.js';
import {
  SESSION_COOKIE,
  clearSessionCookies,
  parseCookies,
  setSessionCookies,
} from '../lib/session.js';

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
    res.json({ user: result.user });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
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
