import { Router } from 'express';
import { EntityStatus, UserRole } from '../entities/enums.js';
import { asyncHandler, parseInput } from '../lib/http.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { uuidParam, vesselBody, vesselPatchBody } from './schemas.js';
import { createVessel, getVessel, listVessels, updateVessel } from '../services/vessels.js';

export const vesselsRouter = Router();

vesselsRouter.use(requireAuth, requireRoles(UserRole.BACKOFFICE));

vesselsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
    res.json({ vessels: await listVessels({ search, clientId }) });
  }),
);

vesselsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseInput(uuidParam, req.params);
    res.json({ vessel: await getVessel(id) });
  }),
);

vesselsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = parseInput(vesselBody, req.body);
    const vessel = await createVessel(
      {
        clientId: body.clientId,
        name: body.name,
        imoNumber: body.imoNumber ?? null,
        vesselType: body.vesselType ?? null,
        currentLocation: body.currentLocation ?? null,
        description: body.description ?? null,
        status: body.status as EntityStatus | undefined,
      },
      req.user!.id,
    );
    res.status(201).json({ vessel });
  }),
);

vesselsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseInput(uuidParam, req.params);
    const body = parseInput(vesselPatchBody, req.body);
    const vessel = await updateVessel(id, {
      ...body,
      status: body.status as EntityStatus | undefined,
    });
    res.json({ vessel });
  }),
);
