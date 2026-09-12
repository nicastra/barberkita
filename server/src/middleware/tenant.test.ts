import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import type { AuthUser } from '../services/auth-service';
import type { TenantService } from '../services/tenant-service';
import { requirePlatformAdmin, requireTenantContext } from './tenant';

const user: AuthUser = {
  id: '00000000-0000-4000-8000-000000000001',
  shopId: '00000000-0000-4000-8000-000000000002',
  name: 'Tenant User',
  email: 'tenant@example.com',
  role: 'staff',
};

const tenant = {
  userId: user.id,
  organizationId: '00000000-0000-4000-8000-000000000003',
  shopId: user.shopId,
  organizationRole: 'organization_member' as const,
  shopRole: 'receptionist' as const,
  organizationLifecycle: 'active' as const,
};

function appFor(service: TenantService) {
  const app = new Hono<{
    Variables: {
      user: AuthUser;
      sessionToken: string;
      tenant: typeof tenant;
    };
  }>();
  app.use('*', async (context, next) => {
    context.set('user', user);
    context.set('sessionToken', 'test-token');
    await next();
  });
  app.use('/shops/:shopId/*', requireTenantContext(service));
  app.get('/shops/:shopId/resource', (context) =>
    context.json({ tenant: context.get('tenant') }),
  );
  app.post('/shops/:shopId/resource', (context) =>
    context.text('created', 201),
  );
  return app;
}

describe('tenant authorization middleware', () => {
  it('rejects a shop scope the user does not belong to', async () => {
    const app = appFor({
      resolve: async () => null,
      list: async () => [],
      getOrganization: async () => null,
      listOrganizationShops: async () => null,
      isPlatformAdmin: async () => false,
    });
    const response = await app.request(
      '/shops/00000000-0000-4000-8000-000000000099/resource',
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'TENANT_ACCESS_DENIED' },
    });
  });

  it('passes only the resolver-approved tenant context downstream', async () => {
    const app = appFor({
      resolve: async (userId, shopId) =>
        userId === user.id && shopId === user.shopId ? tenant : null,
      list: async () => [],
      getOrganization: async () => null,
      listOrganizationShops: async () => null,
      isPlatformAdmin: async () => false,
    });
    const response = await app.request(`/shops/${user.shopId}/resource`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ tenant });
  });

  it('recomputes the effective role for the requested branch', async () => {
    const app = appFor({
      resolve: async () => ({
        ...tenant,
        organizationRole: 'organization_member',
        shopRole: 'receptionist',
      }),
      list: async () => [],
      getOrganization: async () => null,
      listOrganizationShops: async () => null,
      isPlatformAdmin: async () => false,
    });
    app.get('/shops/:shopId/role', (context) =>
      context.json({ role: context.get('user').role }),
    );
    const response = await app.request(`/shops/${user.shopId}/role`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ role: 'staff' });
  });

  it('keeps provider access independent from tenant membership', async () => {
    const app = new Hono<{
      Variables: { user: AuthUser; sessionToken: string };
    }>();
    app.use('*', async (context, next) => {
      context.set('user', user);
      context.set('sessionToken', 'test-token');
      await next();
    });
    app.use(
      '*',
      requirePlatformAdmin({
        resolve: async () => tenant,
        list: async () => [],
        getOrganization: async () => null,
        listOrganizationShops: async () => null,
        isPlatformAdmin: async () => false,
      }),
    );
    app.get('/', (context) => context.text('provider'));
    const response = await app.request('/');
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'PROVIDER_ACCESS_DENIED' },
    });
  });

  it('blocks writes for suspended organizations but permits reads', async () => {
    const suspended = {
      ...tenant,
      organizationLifecycle: 'suspended' as const,
    };
    const service: TenantService = {
      resolve: async () => suspended,
      list: async () => [],
      getOrganization: async () => null,
      listOrganizationShops: async () => null,
      isPlatformAdmin: async () => false,
    };
    const app = appFor(service);
    const read = await app.request(`/shops/${user.shopId}/resource`);
    expect(read.status).toBe(200);
    const write = await app.request(`/shops/${user.shopId}/resource`, {
      method: 'POST',
    });
    expect(write.status).toBe(403);
    await expect(write.json()).resolves.toMatchObject({
      error: { code: 'ORGANIZATION_SUSPENDED' },
    });
  });
});
