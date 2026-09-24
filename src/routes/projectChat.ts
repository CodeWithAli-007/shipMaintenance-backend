import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, parseInput } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { uuidParam } from './schemas.js';
import {
  getProjectChatBootstrap,
  listMatrixDevices,
  processChatOutbox,
  revokeMatrixDevice,
} from '../services/matrixProvisioning.js';

export const projectChatRouter = Router();
projectChatRouter.use(requireAuth);
const chatBootstrapQuery = z.object({
  deviceId: z.string().trim().min(8).max(64).regex(/^[A-Za-z0-9._-]+$/),
});
const deviceParam = z.object({
  deviceId: z.string().trim().min(1).max(255),
});

projectChatRouter.get(
  '/chat/devices',
  asyncHandler(async (req, res) => {
    res.json({ devices: await listMatrixDevices(req.user!) });
  }),
);

projectChatRouter.delete(
  '/chat/devices/:deviceId',
  asyncHandler(async (req, res) => {
    const { deviceId } = parseInput(deviceParam, req.params);
    await revokeMatrixDevice(req.user!, deviceId);
    res.status(204).end();
  }),
);

projectChatRouter.get(
  '/projects/:id/chat/bootstrap',
  asyncHandler(async (req, res) => {
    const { id } = parseInput(uuidParam, req.params);
    const { deviceId } = parseInput(chatBootstrapQuery, req.query);
    res.json({ chat: await getProjectChatBootstrap(id, req.user!, deviceId) });
  }),
);

projectChatRouter.post(
  '/projects/:id/chat/sync',
  asyncHandler(async (req, res) => {
    const { id } = parseInput(uuidParam, req.params);
    const { deviceId } = parseInput(chatBootstrapQuery, req.query);
    await getProjectChatBootstrap(id, req.user!, deviceId);
    const processed = await processChatOutbox();
    res.json({ processed });
  }),
);
