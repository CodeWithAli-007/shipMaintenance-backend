import { QueryFailedError } from 'typeorm';
import { ConflictError } from './errors.js';

export function rethrowUnique(error: unknown, message: string): never {
  if (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code === '23505'
  ) {
    throw new ConflictError(message);
  }
  throw error;
}
