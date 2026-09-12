import { createMiddleware } from 'hono/factory';

import type { AuthVariables } from './auth';
import type { TenantContext, TenantService } from '../services/tenant-service';

export type TenantVariables = AuthVariables & { tenant: TenantContext };

function forbidden(
  message: string,
  reason: 'MEMBERSHIP_REQUIRED' | 'INVALID_SCOPE' = 'MEMBERSHIP_REQUIRED',
) {
  return {
    error: { code: 'TENANT_ACCESS_DENIED', reason, message },
  } as const;
}

/** Require the authenticated user to be an active member of the requested shop. */
export function requireTenantContext(tenantService: TenantService) {
  return createMiddleware<{ Variables: TenantVariables }>(
    async (context, next) => {
      const user = context.get('user');
      const shopId = context.req.param('shopId');
      if (!shopId)
        return context.json(
          forbidden(
            'A shop scope is required for this operation.',
            'INVALID_SCOPE',
          ),
          400,
        );
      const tenant = await tenantService.resolve(user.id, shopId);
      if (!tenant)
        return context.json(
          forbidden('You do not have access to this shop.'),
          403,
        );
      context.set('tenant', tenant);
      // The URL is only a candidate scope. Downstream services receive the
      // resolver-approved branch, even when a legacy session points elsewhere.
      context.set('user', {
        ...user,
        shopId: tenant.shopId,
        role:
          tenant.organizationRole === 'organization_owner' ||
          tenant.shopRole === 'shop_manager'
            ? 'owner'
            : 'staff',
        tenant,
      });
      if (
        tenant.organizationLifecycle === 'suspended' &&
        !['GET', 'HEAD', 'OPTIONS'].includes(context.req.method)
      )
        return context.json(
          {
            error: {
              code: 'ORGANIZATION_SUSPENDED',
              message: 'This organization is suspended and cannot be changed.',
            },
          },
          403,
        );
      await next();
    },
  );
}

/** Provider routes use an explicit platform-admin registration, never tenant roles. */
export function requirePlatformAdmin(tenantService: TenantService) {
  return createMiddleware<{ Variables: AuthVariables }>(
    async (context, next) => {
      if (!(await tenantService.isPlatformAdmin(context.get('user').id)))
        return context.json(
          {
            error: {
              code: 'PROVIDER_ACCESS_DENIED',
              message: 'Platform administrator access is required.',
            },
          },
          403,
        );
      await next();
    },
  );
}

/** Require an active organization membership for organization-scoped routes. */
export function requireOrganizationMembership(tenantService: TenantService) {
  return createMiddleware<{ Variables: AuthVariables }>(
    async (context, next) => {
      const organizationId = context.req.param('organizationId');
      if (!organizationId)
        return context.json(
          forbidden(
            'An organization scope is required for this operation.',
            'INVALID_SCOPE',
          ),
          400,
        );
      const organization = await tenantService.getOrganization(
        context.get('user').id,
        organizationId,
      );
      if (!organization)
        return context.json(
          forbidden('You do not have access to this organization.'),
          403,
        );
      if (
        organization.lifecycle === 'suspended' &&
        !['GET', 'HEAD', 'OPTIONS'].includes(context.req.method)
      )
        return context.json(
          {
            error: {
              code: 'ORGANIZATION_SUSPENDED',
              message: 'This organization is suspended and cannot be changed.',
            },
          },
          403,
        );
      await next();
    },
  );
}

/**
 * Compatibility routes do not carry a shop parameter. Resolve the session's
 * active branch before allowing the legacy handler to run so suspension and
 * membership changes have the same immediate effect as namespaced routes.
 */
export function requireLegacyTenantContext(tenantService: TenantService) {
  return createMiddleware<{ Variables: TenantVariables }>(
    async (context, next) => {
      const user = context.get('user');
      if (!user.shopId) return next();
      const tenant = await tenantService.resolve(user.id, user.shopId);
      if (!tenant)
        return context.json(
          forbidden('You do not have access to this shop.'),
          403,
        );
      context.set('tenant', tenant);
      context.set('user', {
        ...user,
        shopId: tenant.shopId,
        role:
          tenant.organizationRole === 'organization_owner' ||
          tenant.shopRole === 'shop_manager'
            ? 'owner'
            : 'staff',
        tenant,
      });
      if (
        tenant.organizationLifecycle === 'suspended' &&
        !['GET', 'HEAD', 'OPTIONS'].includes(context.req.method)
      )
        return context.json(
          {
            error: {
              code: 'ORGANIZATION_SUSPENDED',
              message: 'This organization is suspended and cannot be changed.',
            },
          },
          403,
        );
      await next();
    },
  );
}
