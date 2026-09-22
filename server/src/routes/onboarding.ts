import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { requireAuth } from '../middleware/auth';
import {
  requireTenantContext,
  type TenantVariables,
} from '../middleware/tenant';
import { tenantShopParamsSchema } from '../schemas/tenant';
import type { AuthService } from '../services/auth-service';
import type { OnboardingService } from '../services/onboarding-service';
import type { TenantService } from '../services/tenant-service';

/** Tenant-scoped setup state; every item is calculated from persisted records. */
export function createOnboardingRoutes(
  authService: AuthService,
  tenantService: TenantService,
  onboardingService: OnboardingService,
) {
  const app = new Hono<{ Variables: TenantVariables }>();
  app.use('*', requireAuth(authService));
  app.use(
    '*',
    zValidator('param', tenantShopParamsSchema),
    requireTenantContext(tenantService),
  );
  app.get('/', async (context) => {
    const shopId = context.req.param('shopId');
    if (!shopId)
      return context.json(
        {
          error: {
            code: 'TENANT_ACCESS_DENIED',
            message: 'A shop scope is required for this operation.',
          },
        },
        400,
      );
    const checklist = await onboardingService.getChecklist(
      context.get('user').id,
      shopId,
    );
    return checklist
      ? context.json({ checklist })
      : context.json(
          {
            error: {
              code: 'TENANT_ACCESS_DENIED',
              message: 'You do not have access to this shop.',
            },
          },
          403,
        );
  });
  return app;
}
