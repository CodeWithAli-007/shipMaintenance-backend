import { Router } from 'express';
import { UserRole } from '../entities/enums.js';
import { asyncHandler } from '../lib/http.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { ValidationError } from '../lib/errors.js';
import { listUsers } from '../services/users.js';

export const usersRouter = Router();

usersRouter.use(requireAuth, requireRoles(UserRole.BACKOFFICE));

usersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const role = typeof req.query.role === 'string' ? req.query.role : undefined;
    if (role && !Object.values(UserRole).includes(role as UserRole)) {
      throw new ValidationError('Unknown role');
    }
    res.json({ users: await listUsers(role as UserRole | undefined) });
  }),
);
