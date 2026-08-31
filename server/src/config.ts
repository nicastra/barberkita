import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.string().url(),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  AUTH_RATE_LIMIT: z.coerce.number().int().min(1).max(1_000).default(10),
  PUBLIC_RATE_LIMIT: z.coerce.number().int().min(1).max(10_000).default(60),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(3_600_000)
    .default(60_000),
  MAX_REQUEST_BODY_BYTES: z.coerce
    .number()
    .int()
    .min(1_024)
    .max(10_485_760)
    .default(262_144),
});

const originSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.origin === value
    );
  }, 'Use an exact HTTP or HTTPS origin');

export interface AppConfig {
  port: number;
  databaseUrl: string;
  allowedOrigins: string[];
  production: boolean;
  authRateLimit: number;
  publicRateLimit: number;
  rateLimitWindowMs: number;
  maxRequestBodyBytes: number;
}

export function parseConfig(
  environment: Record<string, string | undefined>,
): AppConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    throw new Error('Invalid server environment configuration.');
  }

  const allowedOriginsResult = z
    .array(originSchema)
    .min(1)
    .safeParse(
      result.data.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()),
    );
  if (!allowedOriginsResult.success) {
    throw new Error('Invalid server environment configuration.');
  }
  if (
    result.data.NODE_ENV === 'production' &&
    allowedOriginsResult.data.some(
      (origin) => new URL(origin).protocol !== 'https:',
    )
  )
    throw new Error('Invalid server environment configuration.');

  return {
    port: result.data.PORT,
    databaseUrl: result.data.DATABASE_URL,
    allowedOrigins: allowedOriginsResult.data,
    production: result.data.NODE_ENV === 'production',
    authRateLimit: result.data.AUTH_RATE_LIMIT,
    publicRateLimit: result.data.PUBLIC_RATE_LIMIT,
    rateLimitWindowMs: result.data.RATE_LIMIT_WINDOW_MS,
    maxRequestBodyBytes: result.data.MAX_REQUEST_BODY_BYTES,
  };
}
