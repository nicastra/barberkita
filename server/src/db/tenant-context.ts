import { sql } from 'drizzle-orm';

import type { Database } from './client';

export interface DatabaseTenantContext {
  userId: string;
  organizationId?: string;
  shopId?: string;
}

export type DatabaseTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

/**
 * Set request scope as transaction-local PostgreSQL configuration.
 * `is_local = true` ensures pooled connections are reset on commit/rollback.
 */
export async function withTenantDatabaseContext<T>(
  database: Database,
  context: DatabaseTenantContext,
  operation: (transaction: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  return database.transaction(async (transaction) => {
    await transaction.execute(
      sql`select set_config('cukurpro.user_id', ${context.userId}, true)`,
    );
    await transaction.execute(
      sql`select set_config('cukurpro.organization_id', ${context.organizationId ?? ''}, true)`,
    );
    await transaction.execute(
      sql`select set_config('cukurpro.shop_id', ${context.shopId ?? ''}, true)`,
    );
    return operation(transaction);
  });
}
