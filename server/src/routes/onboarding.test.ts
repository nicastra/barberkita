import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';

import type { AuthService, AuthUser } from '../services/auth-service';
import type {
  OnboardingChecklist,
  OnboardingService,
} from '../services/onboarding-service';
import type { TenantService } from '../services/tenant-service';
import { createOnboardingRoutes } from './onboarding';

const shopId = '00000000-0000-4000-8000-000000000002';
const user: AuthUser = {
  id: '00000000-0000-4000-8000-000000000001',
  shopId,
  name: 'Owner',
  email: 'owner@example.com',
  role: 'owner',
};

function auth(): AuthService {
  return {
    signIn: async () => null,
    signOut: async () => undefined,
    getUser: async () => user,
    createStaff: async () => user,
    listStaff: async () => [],
    updateStaff: async () => null,
    deleteStaff: async () => false,
  };
}

function tenant(): TenantService {
  return {
    resolve: async () => ({
      userId: user.id,
      organizationId: '00000000-0000-4000-8000-000000000003',
      shopId,
      organizationRole: 'organization_owner',
      shopRole: 'shop_manager',
      organizationLifecycle: 'trialing',
    }),
    list: async () => [],
    getOrganization: async () => null,
    listOrganizationShops: async () => null,
    isPlatformAdmin: async () => false,
  };
}

const checklist: OnboardingChecklist = {
  organizationId: '00000000-0000-4000-8000-000000000003',
  shopId,
  complete: false,
  items: [
    {
      id: 'business_details',
      label: 'Complete business details',
      complete: true,
    },
  ],
  milestones: [],
};

describe('tenant onboarding checklist route', () => {
  it('returns persisted-configuration checklist for an authorized shop', async () => {
    const onboarding: OnboardingService = {
      getChecklist: async () => checklist,
    };
    const app = new Hono();
    app.route(
      `/shops/:shopId/onboarding`,
      createOnboardingRoutes(auth(), tenant(), onboarding),
    );
    const response = await app.request(`/shops/${shopId}/onboarding`, {
      headers: { Authorization: 'Bearer token' },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ checklist });
  });
});
