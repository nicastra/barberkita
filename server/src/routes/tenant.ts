import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { requireAuth } from '../middleware/auth';
import {
  requireTenantContext,
  type TenantVariables,
} from '../middleware/tenant';
import { tenantShopParamsSchema } from '../schemas/tenant';
import type { AuthService } from '../services/auth-service';
import type { TenantService } from '../services/tenant-service';

export function createTenantRoutes(
  authService: AuthService,
  tenantService: TenantService,
) {
  const app = new Hono<{ Variables: TenantVariables }>();
  app.use('*', requireAuth(authService));
  app.get('/', async (context) =>
    context.json({
      memberships: await tenantService.list(context.get('user').id),
    }),
  );
  app.use(
    '/:shopId/*',
    zValidator('param', tenantShopParamsSchema),
    requireTenantContext(tenantService),
  );
  app.get('/:shopId/context', (context) =>
    context.json({ tenant: context.get('tenant') }),
  );
  return app;
}
