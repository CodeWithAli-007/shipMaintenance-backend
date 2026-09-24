import 'reflect-metadata';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeDatabase, initializeDatabase } from './db/database.js';
import { purgeExpiredMedia } from './services/findingMedia.js';
import { processChatOutbox } from './services/matrixProvisioning.js';

async function bootstrap(): Promise<void> {
  await initializeDatabase();

  const app = createApp();

  const server = app.listen(env.port, () => {
    console.log(
      `API listening on http://localhost:${env.port} (${env.nodeEnv})`,
    );
  });
  const chatOutboxTimer = setInterval(() => {
    void processChatOutbox().catch((error: unknown) => {
      console.error('Chat membership synchronization failed:', error);
    });
  }, 10_000);
  chatOutboxTimer.unref();
  void processChatOutbox().catch(() => undefined);

  const mediaExpiryTimer = setInterval(() => {
    void purgeExpiredMedia().catch((error: unknown) => {
      console.error('Expired media cleanup failed:', error);
    });
  }, 15 * 60 * 1000);
  mediaExpiryTimer.unref();
  void purgeExpiredMedia().catch(() => undefined);

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down...`);
    clearInterval(chatOutboxTimer);
    clearInterval(mediaExpiryTimer);
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
