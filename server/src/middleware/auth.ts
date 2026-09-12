import { createMiddleware } from 'hono/factory';

import type { AuthService, AuthUser } from '../services/auth-service';
import type { TenantContext } from '../services/tenant-service';

export type AuthVariables = {
  user: AuthUser;
  sessionToken: string;
  tenant?: TenantContext;
};

export function requireAuth(authService: AuthService) {
  return createMiddleware<{ Variables: AuthVariables }>(
    async (context, next) => {
      const header = context.req.header('Authorization');
      const cookie = context.req
        .header('Cookie')
        ?.match(/(?:^|;\s*)cukurpro_session=([^;]+)/)?.[1];
      const token = header?.startsWith('Bearer ')
        ? header.slice(7).trim()
        : cookie;
      if (!token)
        return context.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication is required.',
            },
          },
          401,
        );
      const user = await authService.getUser(token);
      if (!user)
        return context.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication is required.',
            },
          },
          401,
        );
      const tenant = context.get('tenant');
      context.set(
        'user',
        tenant ? { ...user, shopId: tenant.shopId, tenant } : user,
      );
      context.set('sessionToken', token);
      await next();
    },
  );
}

export function requireOwner() {
  return createMiddleware<{ Variables: AuthVariables }>(
    async (context, next) => {
      const user = context.get('user');
      const tenant = context.get('tenant');
      const tenantOwner =
        tenant &&
        (tenant.shopRole === 'shop_manager' ||
          tenant.organizationRole === 'organization_owner' ||
          tenant.organizationRole === 'organization_admin');
      if (user.role !== 'owner' && !tenantOwner)
        return context.json(
          {
            error: {
              code: tenant ? 'TENANT_ROLE_FORBIDDEN' : 'FORBIDDEN',
              message: tenant
                ? 'A manager or organization administrator role is required.'
                : 'Owner access is required.',
            },
          },
          403,
        );
      await next();
    },
  );
}

/** Require a password recheck performed within the configured time window. */
export function requireRecentReauthentication(
  authService: AuthService,
  maxAgeMs = 15 * 60_000,
) {
  return createMiddleware<{ Variables: AuthVariables }>(
    async (context, next) => {
      const check = authService.hasRecentReauthentication;
      if (!check || !(await check(context.get('sessionToken'), maxAgeMs)))
        return context.json(
          {
            error: {
              code: 'REAUTHENTICATION_REQUIRED',
              message: 'Recent reauthentication is required for this action.',
            },
          },
          403,
        );
      await next();
    },
  );
}
