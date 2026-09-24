import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4090),
  POSTGRES_HOST: z.string().min(1).default('localhost'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_USER: z.string().min(1).default('postgres'),
  POSTGRES_PASSWORD: z.string().default(''),
  POSTGRES_DB: z.string().min(1, 'POSTGRES_DB is required'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
  MEDIA_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  MEDIA_STORAGE_PATH: z.string().min(1).default('.data/media'),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_PREFIX: z.string().optional(),
  AWS_S3_ENDPOINT: z.string().optional(),
  MATRIX_INTERNAL_URL: z.string().url().default('http://localhost:8008'),
  MATRIX_PUBLIC_URL: z.string().url().default('http://localhost:5173'),
  MATRIX_SERVER_NAME: z.string().min(1).default('ship-maintenance.local'),
  MATRIX_ADMIN_USERNAME: z.string().min(1).default('shipmaintenance_bridge'),
  MATRIX_ADMIN_PASSWORD: z.string().min(16).default('local-development-bridge-password'),
  MATRIX_USER_PASSWORD_SECRET: z.string().min(32).default('local-development-user-password-secret'),
  MATRIX_REGISTRATION_SECRET_FILE: z.string().min(1).default('matrix/registration.secret'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

if (parsed.data.STORAGE_PROVIDER === 's3') {
  const missing = (
    [
      ['AWS_REGION', parsed.data.AWS_REGION],
      ['AWS_S3_BUCKET', parsed.data.AWS_S3_BUCKET],
      ['AWS_ACCESS_KEY_ID', parsed.data.AWS_ACCESS_KEY_ID],
      ['AWS_SECRET_ACCESS_KEY', parsed.data.AWS_SECRET_ACCESS_KEY],
    ] as const
  ).filter(([, value]) => !value);
  if (missing.length) {
    throw new Error(
      `STORAGE_PROVIDER=s3 requires: ${missing.map(([name]) => name).join(', ')}`,
    );
  }
}

const data = parsed.data;

export const env = {
  nodeEnv: data.NODE_ENV,
  port: data.PORT,
  postgres: {
    host: data.POSTGRES_HOST,
    port: data.POSTGRES_PORT,
    username: data.POSTGRES_USER,
    password: data.POSTGRES_PASSWORD,
    database: data.POSTGRES_DB,
  },
  corsOrigins: data.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  isProduction: data.NODE_ENV === 'production',
  isDevelopment: data.NODE_ENV === 'development',
  sessionTtlHours: data.SESSION_TTL_HOURS,
  mediaRetentionDays: data.MEDIA_RETENTION_DAYS,
  storage: {
    provider: data.STORAGE_PROVIDER,
    localPath: data.MEDIA_STORAGE_PATH,
    s3: {
      region: data.AWS_REGION ?? '',
      bucket: data.AWS_S3_BUCKET ?? '',
      accessKeyId: data.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: data.AWS_SECRET_ACCESS_KEY ?? '',
      prefix: data.AWS_S3_PREFIX || undefined,
      endpoint: data.AWS_S3_ENDPOINT || undefined,
    },
  },
  matrix: {
    internalUrl: data.MATRIX_INTERNAL_URL.replace(/\/$/, ''),
    publicUrl: data.MATRIX_PUBLIC_URL.replace(/\/$/, ''),
    serverName: data.MATRIX_SERVER_NAME,
    adminUsername: data.MATRIX_ADMIN_USERNAME,
    adminPassword: data.MATRIX_ADMIN_PASSWORD,
    userPasswordSecret: data.MATRIX_USER_PASSWORD_SECRET,
    registrationSecretFile: data.MATRIX_REGISTRATION_SECRET_FILE,
  },
};
