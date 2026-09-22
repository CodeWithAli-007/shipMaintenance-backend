import { Router } from 'express';
import { EntityStatus, UserRole } from '../entities/enums.js';
import { asyncHandler, parseInput } from '../lib/http.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { memberBody, teamBody, teamPatchBody, userIdParam, uuidParam } from './schemas.js';
import {
  addTeamMember,
  createTeam,
  getTeam,
  listTeams,
  removeTeamMember,
  updateTeam,
} from '../services/teams.js';

export const teamsRouter = Router();

teamsRouter.use(requireAuth, requireRoles(UserRole.BACKOFFICE));

teamsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ teams: await listTeams() });
  }),
);

teamsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseInput(uuidParam, req.params);
    res.json({ team: await getTeam(id) });
  }),
);

teamsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = parseInput(teamBody, req.body);
    const team = await createTeam(
      {
        name: body.name,
        description: body.description ?? null,
        status: body.status as EntityStatus | undefined,
      },
      req.user!.id,
    );
    res.status(201).json({ team });
  }),
);

teamsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseInput(uuidParam, req.params);
    const body = parseInput(teamPatchBody, req.body);
    const team = await updateTeam(id, {
      ...body,
      status: body.status as EntityStatus | undefined,
    });
    res.json({ team });
  }),
);

teamsRouter.post(
  '/:id/members',
  asyncHandler(async (req, res) => {
    const { id } = parseInput(uuidParam, req.params);
    const body = parseInput(memberBody, req.body);
    const team = await addTeamMember(id, body.userId, req.user!.id);
    res.status(201).json({ team });
  }),
);

teamsRouter.post(
  '/:id/members/:userId/remove',
  asyncHandler(async (req, res) => {
    const { id, userId } = parseInput(userIdParam, req.params);
    const team = await removeTeamMember(id, userId, req.user!.id);
    res.json({ team });
  }),
);
