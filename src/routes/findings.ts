import { z } from 'zod';
import { uuidString } from './schemas.js';
import { getMediaFile, messageBody, saveMessage } from '../services/findingMedia.js';
import { Router } from 'express';
import { FindingSeverity, FindingStatus } from '../entities/enums.js';
import { asyncHandler, parseInput } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import {
  createFindingBody,
  findingUpdateBody,
  projectIdParam,
  updateFindingBody,
  uuidParam,
} from './schemas.js';
import {
  addFindingUpdate,
  createFinding,
  getFinding,
  listProjectFindings,
  updateFinding,
} from '../services/findings.js';

export const findingsRouter = Router();

findingsRouter.use(requireAuth);

findingsRouter.get(
  '/projects/:projectId/findings',
  asyncHandler(async (req, res) => {
    const { projectId } = parseInput(projectIdParam, req.params);
    res.json({ findings: await listProjectFindings(projectId, req.user!) });
  }),
);

findingsRouter.post(
  '/projects/:projectId/findings',
  asyncHandler(async (req, res) => {
    const { projectId } = parseInput(projectIdParam, req.params);
    const body = parseInput(createFindingBody, req.body);
    const finding = await createFinding(
      projectId,
      {
        title: body.title ?? null,
        description: body.description,
        severity: body.severity as FindingSeverity,
        equipmentName: body.equipmentName ?? null,
        equipmentModel: body.equipmentModel ?? null,
        equipmentLocation: body.equipmentLocation ?? null,
      },
      req.user!,
    );
    res.status(201).json({ finding });
  }),
);

findingsRouter.get(
  '/findings/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseInput(uuidParam, req.params);
    res.json({ finding: await getFinding(id, req.user!) });
  }),
);

findingsRouter.patch(
  '/findings/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseInput(uuidParam, req.params);
    const body = parseInput(updateFindingBody, req.body);
    const finding = await updateFinding(
      id,
      {
        ...body,
        severity: body.severity as FindingSeverity | undefined,
        status: body.status as FindingStatus | undefined,
      },
      req.user!,
    );
    res.json({ finding });
  }),
);

findingsRouter.post(
  '/findings/:id/updates',
  asyncHandler(async (req, res) => {
    const { id } = parseInput(uuidParam, req.params);
    const body = parseInput(findingUpdateBody, req.body);
    const finding = await addFindingUpdate(id, body.note, req.user!);
    res.status(201).json({ finding });
  }),
);

findingsRouter.post('/findings/:id/messages', asyncHandler(async (req, res) => {
  const { id } = parseInput(uuidParam, req.params);
  await saveMessage(id, parseInput(messageBody, req.body), req.user!);
  res.status(201).json({ finding: await getFinding(id, req.user!) });
}));
findingsRouter.get('/findings/:id/media/:mediaId', asyncHandler(async (req, res) => {
  const { id, mediaId } = parseInput(z.object({ id: uuidString, mediaId: uuidString }), req.params);
  const { asset, bytes } = await getMediaFile(id, mediaId, req.user!);
  res.setHeader('Content-Type', asset.mimeType);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `${asset.mediaType === 'DOCUMENT' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(asset.originalFilename)}`);
  res.send(bytes);
}));
