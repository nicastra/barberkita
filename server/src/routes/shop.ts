import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { requireAuth, requireOwner } from '../middleware/auth';
import { updateShopSchema } from '../schemas/shop';
import type { AuthService, AuthUser } from '../services/auth-service';
import type { ShopService } from '../services/shop-service';

export function createShopRoutes(
  authService: AuthService,
  shopService: ShopService,
) {
  const app = new Hono<{
    Variables: { user: AuthUser; sessionToken: string };
  }>();
  app.use('*', requireAuth(authService));
  app.get('/', async (context) => {
    const shop = await shopService.get(context.get('user').shopId);
    return shop
      ? context.json({ shop })
      : context.json(
          { error: { code: 'NOT_FOUND', message: 'Shop not found.' } },
          404,
        );
  });
  app.patch(
    '/',
    requireOwner(),
    zValidator('json', updateShopSchema),
    async (context) => {
      const shop = await shopService.update(
        context.get('user'),
        context.req.valid('json'),
      );
      return shop
        ? context.json({ shop })
        : context.json(
            { error: { code: 'NOT_FOUND', message: 'Shop not found.' } },
            404,
          );
    },
  );
  return app;
}
