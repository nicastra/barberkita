import { describe, expect, it } from 'vitest';
import type { AuthService, AuthUser } from '../services/auth-service';
import type { TenantService } from '../services/tenant-service';
import { LifecycleDomainError } from '../services/tenant-service';
import {
  SupportAccessError,
  type SupportAccessService,
} from '../services/support-access-service';
import { createProviderRoutes } from './provider';

const admin: AuthUser = {
  id: '00000000-0000-4000-8000-000000000001',
  shopId: '',
  name: 'Platform Admin',
  email: 'admin@example.com',
  role: 'staff',
};
function auth(recent: boolean): AuthService {
  return {
    signIn: async () => null,
    signOut: async () => undefined,
    getUser: async () => admin,
    hasRecentReauthentication: async () => recent,
    createStaff: async () => admin,
    listStaff: async () => [],
    updateStaff: async () => null,
    deleteStaff: async () => false,
  };
}
function tenant(platformAdmin: boolean): TenantService {
  return {
    resolve: async () => null,
    list: async () => [],
    getOrganization: async () => null,
    listOrganizationShops: async () => null,
    isPlatformAdmin: async () => platformAdmin,
  };
}
const body = {
  organization: {
    name: 'North Group',
    slug: 'north-group',
    lifecycle: 'trialing',
  },
  shop: {
    name: 'North One',
    slug: 'north-one',
    phone: '+62123',
    email: 'north@example.com',
    address: 'Jakarta',
    timezone: 'Asia/Jakarta',
  },
  owner: { email: 'owner@example.com', expiresInHours: 72 },
};

describe('provider onboarding', () => {
  it('rejects tenant users without platform-admin registration', async () => {
    const response = await createProviderRoutes(auth(true), tenant(false), {
      createOrganization: async () => {
        throw new Error('unused');
      },
    }).request('/organizations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(403);
  });
  it('requires recent reauthentication', async () => {
    const response = await createProviderRoutes(auth(false), tenant(true), {
      createOrganization: async () => {
        throw new Error('unused');
      },
    }).request('/organizations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'REAUTHENTICATION_REQUIRED' },
    });
  });
  it('creates the organization and returns the owner token once', async () => {
    let calls = 0;
    const response = await createProviderRoutes(auth(true), tenant(true), {
      createOrganization: async () => {
        calls += 1;
        return {
          organization: { id: 'org' },
          shop: { id: 'shop' },
          invitation: {
            id: 'invite',
            email: body.owner.email,
            expiresAt: new Date('2026-01-01'),
          },
          token: 'one-time-token',
        } as never;
      },
    }).request('/organizations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(201);
    expect(calls).toBe(1);
    await expect(response.json()).resolves.toMatchObject({
      token: 'one-time-token',
      invitation: { id: 'invite' },
    });
  });
  it('serves metadata-only dashboard data to platform admins', async () => {
    const response = await createProviderRoutes(
      auth(true),
      tenant(true),
      undefined,
      {
        getDashboard: async () => ({
          organizations: [],
          recentActivity: [],
          health: { status: 'ok', checks: { database: 'ok' } },
        }),
      },
    ).request('/dashboard', {
      headers: { Authorization: 'Bearer token' },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      organizations: [],
      recentActivity: [],
      health: { status: 'ok', checks: { database: 'ok' } },
    });
  });
  it('transitions lifecycle with a reason after reauthentication', async () => {
    let received:
      { organizationId: string; lifecycle: string; reason: string } | undefined;
    const response = await createProviderRoutes(auth(true), {
      ...tenant(true),
      transitionLifecycle: async (
        _actor,
        organizationId,
        lifecycle,
        reason,
      ) => {
        received = { organizationId, lifecycle, reason };
        return {
          previousLifecycle: 'active',
          organization: { id: organizationId, lifecycle },
        } as never;
      },
    }).request(
      '/organizations/00000000-0000-4000-8000-000000000002/lifecycle',
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lifecycle: 'suspended', reason: 'Past due' }),
      },
    );
    expect(response.status).toBe(200);
    expect(received).toEqual({
      organizationId: '00000000-0000-4000-8000-000000000002',
      lifecycle: 'suspended',
      reason: 'Past due',
    });
  });
  it('returns a stable conflict for an invalid lifecycle transition', async () => {
    const response = await createProviderRoutes(auth(true), {
      ...tenant(true),
      transitionLifecycle: async () => {
        throw new LifecycleDomainError(
          'INVALID_LIFECYCLE_TRANSITION',
          'Cannot transition an archived organization to active.',
        );
      },
    }).request(
      '/organizations/00000000-0000-4000-8000-000000000002/lifecycle',
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lifecycle: 'active', reason: 'Restore' }),
      },
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INVALID_LIFECYCLE_TRANSITION' },
    });
  });
});

describe('provider support access', () => {
  const grant = {
    id: '00000000-0000-4000-8000-000000000004',
    organizationId: '00000000-0000-4000-8000-000000000002',
    providerUserId: admin.id,
    requestedByUserId: admin.id,
    approvedByUserId: null,
    reason: 'Investigate a reported setup issue',
    status: 'pending_approval' as const,
    breakGlass: false,
    expiresAt: new Date('2026-01-01T00:00:00Z'),
    approvedAt: null,
    revokedAt: null,
    createdAt: new Date('2025-12-01T00:00:00Z'),
  };
  function support(): SupportAccessService {
    return {
      request: async () => grant,
      approve: async () => ({ ...grant, status: 'active' }),
      createBreakGlass: async () => ({
        ...grant,
        status: 'active',
        breakGlass: true,
      }),
      revoke: async () => ({ ...grant, status: 'revoked' }),
      listForOrganization: async () => [grant],
      listForProvider: async () => [grant],
      authorize: async (_provider, _grant, organizationId) => {
        if (organizationId !== grant.organizationId)
          throw new SupportAccessError(
            'SUPPORT_GRANT_NOT_FOUND',
            'Support grant is not valid for this organization.',
          );
        return { ...grant, status: 'active' };
      },
    };
  }

  it('keeps ordinary support pending until owner approval', async () => {
    const response = await createProviderRoutes(
      auth(true),
      tenant(true),
      undefined,
      undefined,
      support(),
    ).request('/support-grants', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organizationId: grant.organizationId,
        reason: grant.reason,
        expiresInMinutes: 30,
      }),
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      grant: { status: 'pending_approval', breakGlass: false },
    });
  });

  it('rejects a grant reused for another organization', async () => {
    const response = await createProviderRoutes(
      auth(true),
      tenant(true),
      undefined,
      undefined,
      support(),
    ).request(
      `/support-grants/${grant.id}/authorize/00000000-0000-4000-8000-000000000003`,
      { headers: { Authorization: 'Bearer token' } },
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'SUPPORT_GRANT_NOT_FOUND' },
    });
  });
});
