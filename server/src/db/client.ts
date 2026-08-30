import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

export function createDatabase(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 10,
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    connection: {
      application_name: 'cukurpro_api',
      statement_timeout: 10_000,
    },
  });

  return {
    client,
    database: drizzle(client, { schema }),
  };
}

export type Database = ReturnType<typeof createDatabase>['database'];
