import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import {
  requireAuth,
  requireRecentReauthentication,
  type AuthVariables,
} from '../middleware/auth';
import { requireOrganizationMembership } from '../middleware/tenant';
import { invitationCreateSchema, invitationIdSchema } from '../schemas/auth';
import {
  tenantMembershipParamsSchema,
  tenantOrganizationParamsSchema,
  createOrganizationShopSchema,
  updateMembershipSchema,
  supportGrantIdSchema,
} from '../schemas/tenant';
import type { AuthService } from '../services/auth-service';
import {
  InvitationDomainError,
  type InvitationService,
} from '../services/invitation-service';
import type { TenantService } from '../services/tenant-service';
import {
  SupportAccessError,
  type SupportAccessService,
} from '../services/support-access-service';

function accessDenied() {
  return {
    error: {
      code: 'TENANT_ACCESS_DENIED',
      reason: 'MEMBERSHIP_REQUIRED',
      message: 'You do not have access to this organization.',
    },
  } as const;
}

export function createOrganizationRoutes(
  authService: AuthService,
  tenantService: TenantService,
  invitationService?: InvitationService,
  supportAccessService?: SupportAccessService,
) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.onError((error, context) => {
    if (error instanceof InvitationDomainError)
      return context.json(
        { error: { code: error.code, message: error.message } },
        403,
      );
    throw error;
  });
  app.use('*', requireAuth(authService));
  app.use(
    '/:organizationId',
    zValidator('param', tenantOrganizationParamsSchema),
    requireOrganizationMembership(tenantService),
  );
  app.use(
    '/:organizationId/*',
    zValidator('param', tenantOrganizationParamsSchema),
    requireOrganizationMembership(tenantService),
  );
  app.get(
    '/:organizationId',
    zValidator('param', tenantOrganizationParamsSchema),
    async (context) => {
      const organization = await tenantService.getOrganization(
        context.get('user').id,
        context.req.valid('param').organizationId,
      );
      return organization
        ? context.json({ organization })
        : context.json(accessDenied(), 403);
    },
  );
  if (supportAccessService) {
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
    app.get(
      '/:organizationId/support-grants',
      zValidator('param', tenantOrganizationParamsSchema),
      async (context) => {
        try {
          return context.json({
            grants: await supportAccessService.listForOrganization(
              context.get('user').id,
              context.req.valid('param').organizationId,
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
      '/:organizationId/support-grants/:grantId/approve',
      zValidator(
        'param',
        tenantOrganizationParamsSchema.merge(supportGrantIdSchema),
      ),
      requireRecentReauthentication(authService),
      async (context) => {
        try {
          return context.json({
            grant: await supportAccessService.approve(
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
    app.post(
      '/:organizationId/support-grants/:grantId/revoke',
      zValidator(
        'param',
        tenantOrganizationParamsSchema.merge(supportGrantIdSchema),
      ),
      requireRecentReauthentication(authService),
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
  app.post(
    '/:organizationId/shops',
    zValidator('param', tenantOrganizationParamsSchema),
    zValidator('json', createOrganizationShopSchema),
    requireRecentReauthentication(authService),
    async (context) => {
      const createShop = tenantService.createOrganizationShop;
      if (!createShop)
        return context.json(
          {
            error: {
              code: 'TENANT_ROLE_FORBIDDEN',
              message: 'Branch creation is unavailable.',
            },
          },
          403,
        );
      const shop = await createShop(
        context.get('user').id,
        context.req.valid('param').organizationId,
        context.req.valid('json'),
      );
      return shop
        ? context.json({ shop }, 201)
        : context.json(
            {
              error: {
                code: 'TENANT_ROLE_FORBIDDEN',
                message:
                  'Organization owner or administrator access is required.',
              },
            },
            403,
          );
    },
  );
  app.get(
    '/:organizationId/shops',
    zValidator('param', tenantOrganizationParamsSchema),
    async (context) => {
      const shops = await tenantService.listOrganizationShops(
        context.get('user').id,
        context.req.valid('param').organizationId,
      );
      return shops
        ? context.json({ shops })
        : context.json(accessDenied(), 403);
    },
  );
  if (invitationService) {
    app.get(
      '/:organizationId/invitations',
      zValidator('param', tenantOrganizationParamsSchema),
      requireRecentReauthentication(authService),
      async (context) =>
        context.json({
          invitations: await invitationService.list(
            context.get('user'),
            context.req.valid('param').organizationId,
          ),
        }),
    );
    app.post(
      '/:organizationId/invitations',
      zValidator('param', tenantOrganizationParamsSchema),
      zValidator('json', invitationCreateSchema),
      requireRecentReauthentication(authService),
      async (context) => {
        const result = await invitationService.create(context.get('user'), {
          organizationId: context.req.valid('param').organizationId,
          ...context.req.valid('json'),
        });
        return context.json(result, 201);
      },
    );
    app.post(
      '/:organizationId/invitations/:id/revoke',
      zValidator(
        'param',
        tenantOrganizationParamsSchema.merge(invitationIdSchema),
      ),
      requireRecentReauthentication(authService),
      async (context) => {
        const revoked = await invitationService.revoke(
          context.get('user'),
          context.req.valid('param').organizationId,
          context.req.valid('param').id,
        );
        return revoked
          ? context.body(null, 204)
          : context.json(
              {
                error: {
                  code: 'NOT_FOUND',
                  message: 'Invitation not found.',
                },
              },
              404,
            );
      },
    );
  }
  app.patch(
    '/:organizationId/memberships/:userId',
    zValidator('param', tenantMembershipParamsSchema),
    zValidator('json', updateMembershipSchema),
    requireRecentReauthentication(authService),
    async (context) => {
      const updateMembership = tenantService.updateMembership;
      if (!updateMembership)
        return context.json(
          {
            error: {
              code: 'TENANT_ROLE_FORBIDDEN',
              message: 'Membership changes are unavailable.',
            },
          },
          403,
        );
      const updated = await updateMembership(
        context.get('user').id,
        context.req.valid('param').organizationId,
        {
          userId: context.req.valid('param').userId,
          ...context.req.valid('json'),
        },
      );
      return updated
        ? context.json({ updated: true })
        : context.json(
            {
              error: {
                code: 'TENANT_ROLE_FORBIDDEN',
                message: 'You cannot change this membership.',
              },
            },
            403,
          );
    },
  );
  return app;
}
