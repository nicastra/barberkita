import type { Database } from '../db/client';
import { systemMetadata } from '../db/schema';

export interface DatabaseHealthService {
  check(): Promise<void>;
}

export function createDatabaseHealthService(
  database: Database,
): DatabaseHealthService {
  return {
    async check(): Promise<void> {
      await database
        .select({ id: systemMetadata.id })
        .from(systemMetadata)
        .limit(1);
    },
  };
}
