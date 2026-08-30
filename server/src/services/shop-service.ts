import { eq } from 'drizzle-orm';

import type { Database } from '../db/client';
import { auditLogs, shops } from '../db/schema';
import type { AuthUser } from './auth-service';

export type ShopInput = {
  name: string;
  phone: string;
  email: string;
  address: string;
  timezone: string;
};

export interface ShopService {
  get(shopId: string): Promise<typeof shops.$inferSelect | null>;
  update(
    actor: AuthUser,
    input: {
      name?: string | undefined;
      phone?: string | undefined;
      email?: string | undefined;
      address?: string | undefined;
      timezone?: string | undefined;
    },
  ): Promise<typeof shops.$inferSelect | null>;
}

export function createShopService(database: Database): ShopService {
  return {
    async get(shopId) {
      return database
        .select()
        .from(shops)
        .where(eq(shops.id, shopId))
        .limit(1)
        .then((rows) => rows[0] ?? null);
    },
    async update(actor, input) {
      const [shop] = await database
        .update(shops)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(shops.id, actor.shopId))
        .returning();
      if (!shop) return null;
      await database.insert(auditLogs).values({
        actorStaffUserId: actor.id,
        action: 'shop_updated',
        entityType: 'shop',
        entityId: shop.id,
      });
      return shop;
    },
  };
}
