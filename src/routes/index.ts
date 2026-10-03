import { Router } from 'express';
import { healthRouter } from './health.js';
import { authRouter } from './auth.js';
import { clientsRouter } from './clients.js';
import { vesselsRouter } from './vessels.js';
import { teamsRouter } from './teams.js';
import { projectsRouter } from './projects.js';
import { usersRouter } from './users.js';
import { findingsRouter } from './findings.js';
import { adminRouter } from './admin.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { canAccessProject, canAccessFinding } from '../services/access.js';
import { ForbiddenError, ValidationError } from '../lib/errors.js';
import { UserRole } from '../entities/enums.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/clients', clientsRouter);
apiRouter.use('/vessels', vesselsRouter);
apiRouter.use('/teams', teamsRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use(findingsRouter);

/**
 * Access-helper smoke routes for Milestone 1 verification.
 */
apiRouter.get(
  '/access/projects/:projectId',
  requireAuth,
  async (req, res, next) => {
    try {
      const projectId = String(req.params.projectId ?? '');
      if (!projectId) {
        throw new ValidationError('projectId is required');
      }

      const user = req.user!;
      const allowed =
        user.role === UserRole.BACKOFFICE ||
        (await canAccessProject(user.id, projectId));

      if (!allowed) {
        throw new ForbiddenError('No active project membership');
      }

      res.json({ projectId, allowed: true });
    } catch (error) {
      next(error);
    }
  },
);

apiRouter.get(
  '/access/findings/:findingId',
  requireAuth,
  async (req, res, next) => {
    try {
      const findingId = String(req.params.findingId ?? '');
      if (!findingId) {
        throw new ValidationError('findingId is required');
      }

      const user = req.user!;
      const allowed =
        user.role === UserRole.BACKOFFICE ||
        (await canAccessFinding(user.id, findingId));

      if (!allowed) {
        throw new ForbiddenError('No active finding access');
      }

      res.json({ findingId, allowed: true });
    } catch (error) {
      next(error);
    }
  },
);

/** Placeholder for Milestone 2 Backoffice master-data routes */
apiRouter.get(
  '/backoffice/ping',
  requireAuth,
  requireRoles(UserRole.BACKOFFICE),
  (_req, res) => {
    res.json({ ok: true, module: 'backoffice' });
  },
);
