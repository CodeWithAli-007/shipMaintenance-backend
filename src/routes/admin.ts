import { Router } from 'express';
import { UserRole } from '../entities/enums.js';
import { asyncHandler, parseInput } from '../lib/http.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { ValidationError } from '../lib/errors.js';
import {
  createManagedUserBody,
  updateManagedUserBody,
  uuidParam,
} from './schemas.js';
import {
  createManagedUser,
  deleteManagedUser,
  getManagedUser,
  listManagedUsers,
  updateManagedUser,
} from '../services/users.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRoles(UserRole.ADMIN));

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const role = typeof req.query.role === 'string' ? req.query.role : undefined;
    if (role && role !== UserRole.BACKOFFICE && role !== UserRole.TECHNICIAN) {
      throw new ValidationError('Filter role must be BACKOFFICE or TECHNICIAN');
    }
    const includeInactive =
      req.query.includeInactive === '1' || req.query.includeInactive === 'true';

    res.json({
      users: await listManagedUsers({
        role: role as UserRole | undefined,
        includeInactive,
      }),
    });
  }),
);

adminRouter.get(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseInput(uuidParam, req.params);
    res.json({ user: await getManagedUser(id) });
  }),
);

adminRouter.post(
  '/users',
  asyncHandler(async (req, res) => {
    const body = parseInput(createManagedUserBody, req.body);
    const user = await createManagedUser({
      email: body.email,
      fullName: body.fullName,
      role: body.role as UserRole.BACKOFFICE | UserRole.TECHNICIAN,
      password: body.password,
      isActive: body.isActive,
    });
    res.status(201).json({ user });
  }),
);

adminRouter.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseInput(uuidParam, req.params);
    const body = parseInput(updateManagedUserBody, req.body);
    const user = await updateManagedUser(id, {
      ...body,
      role: body.role as UserRole.BACKOFFICE | UserRole.TECHNICIAN | undefined,
    });
    res.json({ user });
  }),
);

adminRouter.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseInput(uuidParam, req.params);
    const user = await deleteManagedUser(id, req.user!.id);
    res.json({ user });
  }),
);
