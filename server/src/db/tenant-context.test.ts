import { describe, expect, it, vi } from 'vitest';

import type { Database } from './client';
import { withTenantDatabaseContext } from './tenant-context';

describe('transaction-local tenant context', () => {
  it('sets all request values with is_local enabled', async () => {
    const execute = vi.fn(async () => undefined);
    const transaction = { execute };
    const database = {
      transaction: async (
        callback: (value: typeof transaction) => Promise<unknown>,
      ) => callback(transaction),
    } as unknown as Database;

    await withTenantDatabaseContext(
      database,
      {
        userId: 'user-1',
        organizationId: 'organization-1',
        shopId: 'shop-1',
      },
      async (current) => {
        expect(current).toBe(transaction);
      },
    );

    expect(execute).toHaveBeenCalledTimes(3);
    expect(execute.mock.calls).toHaveLength(3);
  });
});
