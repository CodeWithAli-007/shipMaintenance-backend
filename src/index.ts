import 'reflect-metadata';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeDatabase, initializeDatabase } from './db/database.js';
async function bootstrap(): Promise<void> {
  await initializeDatabase();

  const app = createApp();

  const server = app.listen(env.port, env.host, () => {
    console.log(
      `API listening on http://${env.host}:${env.port} (${env.nodeEnv})`,
    );
    if (env.isDevelopment) {
      console.log(`Swagger: http://localhost:${env.port}/api-docs (development only)`);
    }
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down...`);
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch(async (error) => {
  console.error('Failed to start server:', error);
  await closeDatabase();
  process.exit(1);
});
