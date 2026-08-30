import { defineConfig } from 'drizzle-kit';
import { z } from 'zod';

const drizzleEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url(),
});

const environmentResult = drizzleEnvironmentSchema.safeParse(process.env);
if (!environmentResult.success) {
  throw new Error('DATABASE_URL is required for Drizzle commands.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: environmentResult.data.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
