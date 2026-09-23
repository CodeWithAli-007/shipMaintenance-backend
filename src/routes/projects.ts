import { Router } from 'express';
import { ProjectPriority, ProjectStatus, UserRole } from '../entities/enums.js';
import { asyncHandler, parseInput } from '../lib/http.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import {
  createProjectBody,
  memberBody,
  updateProjectBody,
  userIdParam,
  uuidParam,
} from './schemas.js';
import {
  addProjectMember,
  createProject,
  getProject,
  listProjects,
  removeProjectMember,
  updateProject,
} from '../services/projects.js';

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ projects: await listProjects(req.user!) });
  }),
);

projectsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseInput(uuidParam, req.params);
    res.json({ project: await getProject(id, req.user!) });
  }),
);

projectsRouter.post(
  '/',
  requireRoles(UserRole.BACKOFFICE),
  asyncHandler(async (req, res) => {
    const body = parseInput(createProjectBody, req.body);
    const project = await createProject(
      {
        vesselId: body.vesselId,
        title: body.title,
        description: body.description ?? null,
        notes: body.notes ?? null,
        priority: body.priority as ProjectPriority,
        mode: body.mode,
        technicianIds: body.technicianIds,
        teamId: body.teamId ?? null,
        additionalTechnicianIds: body.additionalTechnicianIds,
      },
      req.user!,
    );
    res.status(201).json({ project });
  }),
);

projectsRouter.patch(
  '/:id',
  requireRoles(UserRole.BACKOFFICE),
  asyncHandler(async (req, res) => {
    const { id } = parseInput(uuidParam, req.params);
    const body = parseInput(updateProjectBody, req.body);
    const project = await updateProject(
      id,
      {
        ...body,
        status: body.status as ProjectStatus | undefined,
        priority: body.priority as ProjectPriority | undefined,
      },
      req.user!,
    );
    res.json({ project });
  }),
);

projectsRouter.post(
  '/:id/members',
  requireRoles(UserRole.BACKOFFICE),
  asyncHandler(async (req, res) => {
    const { id } = parseInput(uuidParam, req.params);
    const body = parseInput(memberBody, req.body);
    const project = await addProjectMember(id, body.userId, req.user!);
    res.status(201).json({ project });
  }),
);

projectsRouter.post(
  '/:id/members/:userId/remove',
  requireRoles(UserRole.BACKOFFICE),
  asyncHandler(async (req, res) => {
    const { id, userId } = parseInput(userIdParam, req.params);
    const project = await removeProjectMember(id, userId, req.user!);
    res.json({ project });
  }),
);
