import { AppDataSource } from '../data-source.js';

export async function initializeDatabase(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
}

export async function closeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

export async function checkDatabaseConnection(): Promise<boolean> {
  if (!AppDataSource.isInitialized) {
    return false;
  }

  await AppDataSource.query('SELECT 1');
  return true;
}

export function getRepository<Entity extends object>(
  entity: new () => Entity,
) {
  return AppDataSource.getRepository(entity);
}
