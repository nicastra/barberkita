import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import {
  requireAuth,
  requireRecentReauthentication,
  type AuthVariables,
} from '../middleware/auth';
import { requirePlatformAdmin } from '../middleware/tenant';
import {
  providerLifecycleUpdateSchema,
  providerOrganizationCreateSchema,
  breakGlassSupportGrantSchema,
  supportGrantIdSchema,
  supportGrantOrganizationParamsSchema,
  supportGrantRequestSchema,
  tenantOrganizationParamsSchema,
} from '../schemas/tenant';
import type { AuthService } from '../services/auth-service';
import type { ProviderOnboardingService } from '../services/provider-onboarding-service';
import type { ProviderDashboardService } from '../services/provider-dashboard-service';
import {
  SupportAccessError,
  type SupportAccessService,
} from '../services/support-access-service';
import {
  LifecycleDomainError,
  type TenantService,
} from '../services/tenant-service';

/** Provider-only endpoints. Tenant roles never grant access here. */
export function createProviderRoutes(
  authService: AuthService,
  tenantService: TenantService,
  onboardingService?: ProviderOnboardingService,
  dashboardService?: ProviderDashboardService,
  supportAccessService?: SupportAccessService,
) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requireAuth(authService), requirePlatformAdmin(tenantService));
  app.get('/me', (context) =>
    context.json({
      provider: {
        userId: context.get('user').id,
        role: 'platform_admin' as const,
      },
    }),
  );
  const supportError = (
    context: {
      json: (
        body: { error: { code: string; message: string } },
        status: 403 | 404 | 409,
      ) => Response;
    },
    error: SupportAccessError,
  ) =>
    context.json(
      { error: { code: error.code, message: error.message } },
      error.code === 'SUPPORT_GRANT_NOT_FOUND'
        ? 404
        : error.code === 'SUPPORT_ACCESS_DENIED'
          ? 403
          : 409,
    );
  if (supportAccessService) {
    app.get('/support-grants', async (context) =>
      context.json({
        grants: await supportAccessService.listForProvider(
          context.get('user').id,
        ),
      }),
    );
    app.post(
      '/support-grants',
      requireRecentReauthentication(authService),
      zValidator('json', supportGrantRequestSchema),
      async (context) => {
        try {
          return context.json(
            {
              grant: await supportAccessService.request(
                context.get('user').id,
                context.req.valid('json'),
              ),
            },
            201,
          );
        } catch (error) {
          if (error instanceof SupportAccessError)
            return supportError(context, error);
          throw error;
        }
      },
    );
    app.post(
      '/support-grants/break-glass',
      requireRecentReauthentication(authService),
      zValidator('json', breakGlassSupportGrantSchema),
      async (context) => {
        try {
          return context.json(
            {
              grant: await supportAccessService.createBreakGlass(
                context.get('user').id,
                context.req.valid('json'),
              ),
            },
            201,
          );
        } catch (error) {
          if (error instanceof SupportAccessError)
            return supportError(context, error);
          throw error;
        }
      },
    );
    app.get(
      '/support-grants/:grantId/authorize/:organizationId',
      zValidator('param', supportGrantOrganizationParamsSchema),
      async (context) => {
        try {
          const params = context.req.valid('param');
          return context.json({
            grant: await supportAccessService.authorize(
              context.get('user').id,
              params.grantId,
              params.organizationId,
            ),
          });
        } catch (error) {
          if (error instanceof SupportAccessError)
            return supportError(context, error);
          throw error;
        }
      },
    );
    app.post(
      '/support-grants/:grantId/revoke',
      requireRecentReauthentication(authService),
      zValidator('param', supportGrantIdSchema),
      async (context) => {
        try {
          return context.json({
            grant: await supportAccessService.revoke(
              context.get('user').id,
              context.req.valid('param').grantId,
            ),
          });
        } catch (error) {
          if (error instanceof SupportAccessError)
            return supportError(context, error);
          throw error;
        }
      },
    );
  }
  if (dashboardService)
    app.get('/dashboard', async (context) =>
      context.json(await dashboardService.getDashboard()),
    );
  const transitionLifecycle = tenantService.transitionLifecycle;
  if (transitionLifecycle)
    app.patch(
      '/organizations/:organizationId/lifecycle',
      requireRecentReauthentication(authService),
      zValidator('param', tenantOrganizationParamsSchema),
      zValidator('json', providerLifecycleUpdateSchema),
      async (context) => {
        try {
          const result = await transitionLifecycle(
            context.get('user').id,
            context.req.valid('param').organizationId,
            context.req.valid('json').lifecycle,
            context.req.valid('json').reason,
          );
          return context.json(result);
        } catch (error) {
          if (error instanceof LifecycleDomainError)
            return context.json(
              { error: { code: error.code, message: error.message } },
              error.code === 'ORGANIZATION_NOT_FOUND' ? 404 : 409,
            );
          throw error;
        }
      },
    );
  if (onboardingService)
    app.post(
      '/organizations',
      requireRecentReauthentication(authService),
      zValidator('json', providerOrganizationCreateSchema),
      async (context) =>
        context.json(
          await onboardingService.createOrganization(
            context.get('user').id,
            context.req.valid('json'),
          ),
          201,
        ),
    );
  return app;
}
