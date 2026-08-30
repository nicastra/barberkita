import { z } from 'zod';

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.string().url(),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
});

const originSchema = z.string().url();

export interface AppConfig {
  port: number;
  databaseUrl: string;
  allowedOrigins: string[];
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

  return {
    port: result.data.PORT,
    databaseUrl: result.data.DATABASE_URL,
    allowedOrigins: allowedOriginsResult.data,
  };
}
