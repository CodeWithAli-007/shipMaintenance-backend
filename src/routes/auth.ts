import { Router } from 'express';
import { loginBody } from './schemas.js';
import { asyncHandler, parseInput } from '../lib/http.js';
import { loginWithPassword } from '../services/auth.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = parseInput(loginBody, req.body);
    const result = await loginWithPassword(body.email, body.password);
    res.json(result);
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  }),
);
