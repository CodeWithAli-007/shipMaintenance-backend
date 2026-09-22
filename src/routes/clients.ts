import { Router } from 'express';
import { EntityStatus, UserRole } from '../entities/enums.js';
import { asyncHandler, parseInput } from '../lib/http.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { clientBody, clientPatchBody, uuidParam } from './schemas.js';
import { createClient, getClient, listClients, updateClient } from '../services/clients.js';

export const clientsRouter = Router();

clientsRouter.use(requireAuth, requireRoles(UserRole.BACKOFFICE));

clientsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    res.json({ clients: await listClients(search) });
  }),
);

clientsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseInput(uuidParam, req.params);
    res.json({ client: await getClient(id) });
  }),
);

clientsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = parseInput(clientBody, req.body);
    const client = await createClient(
      {
        name: body.name,
        clientCode: body.clientCode ?? null,
        addressLine1: body.addressLine1 ?? null,
        addressLine2: body.addressLine2 ?? null,
        city: body.city ?? null,
        postalCode: body.postalCode ?? null,
        country: body.country ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        status: body.status as EntityStatus | undefined,
      },
      req.user!.id,
    );
    res.status(201).json({ client });
  }),
);

clientsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseInput(uuidParam, req.params);
    const body = parseInput(clientPatchBody, req.body);
    const client = await updateClient(id, {
      ...body,
      status: body.status as EntityStatus | undefined,
    });
    res.json({ client });
  }),
);
