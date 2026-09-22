import { Router } from 'express';
import { checkDatabaseConnection } from '../db/database.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res, next) => {
  try {
    const dbOk = await checkDatabaseConnection();
    const status = dbOk ? 'ok' : 'degraded';

    res.status(dbOk ? 200 : 503).json({
      status,
      service: 'ship-maintenance-api',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk ? 'up' : 'down',
      },
    });
  } catch (error) {
    next(error);
  }
});
