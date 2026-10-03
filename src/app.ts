import express from 'express';
import {
  requireAuth,
  requireAuthenticatedMutation,
} from './middleware/auth.js';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { mountSwagger } from './swagger.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    helmet({
      // Swagger UI needs inline scripts/styles; relax CSP only in development.
      contentSecurityPolicy: env.isDevelopment
        ? false
        : {
            directives: {
              defaultSrc: ["'self'"],
              baseUri: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(
    cors({
      origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
      credentials: true,
    }),
  );
  app.use('/api/findings/:id/messages', requireAuth, express.json({ limit: '30mb' }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  app.use('/api', requireAuthenticatedMutation);

  const swaggerEnabled = mountSwagger(app);

  app.get('/', (_req, res) => {
    res.json({
      name: 'Shipping Maintenance API',
      version: '0.1.0',
      health: '/api/health',
      ...(swaggerEnabled ? { docs: '/api-docs' } : {}),
    });
  });

  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
