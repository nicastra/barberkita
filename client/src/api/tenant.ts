import { z } from 'zod';

import { apiRequest, setActiveShopId } from './client';

const membershipSchema = z.object({
  organizationId: z.string().uuid(),
  organizationName: z.string(),
  organizationRole: z.enum([
    'organization_owner',
    'organization_admin',
    'organization_member',
  ]),
  organizationLifecycle: z.enum([
    'trialing',
    'active',
    'suspended',
    'archived',
  ]),
  shopId: z.string().uuid(),
  shopSlug: z.string().nullable(),
  shopName: z.string(),
  shopRole: z.enum(['shop_manager', 'receptionist', 'barber']),
});

export type TenantMembership = z.infer<typeof membershipSchema>;

export function listTenantMemberships() {
  return apiRequest('/api/shops', {
    schema: z.object({ memberships: z.array(membershipSchema) }),
  });
}

export function getTenantContext(shopId: string) {
  return apiRequest(`/api/shops/${shopId}/context`, {
    schema: z.object({ tenant: membershipSchema.partial() }),
  });
}

export function switchTenantShop(shopId: string) {
  return apiRequest(`/api/auth/switch-shop/${shopId}`, {
    method: 'POST',
    schema: z.object({ user: z.object({ shopId: z.string().uuid() }) }),
  }).then((result) => {
    setActiveShopId(result.user.shopId);
    return result;
  });
}

const organizationShopSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().nullable(),
  name: z.string(),
  phone: z.string(),
  email: z.string().email(),
  address: z.string(),
  timezone: z.string(),
});

export function createOrganizationShop(
  organizationId: string,
  input: {
    slug: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    timezone: string;
  },
) {
  return apiRequest(`/api/organizations/${organizationId}/shops`, {
    method: 'POST',
    body: input,
    schema: z.object({ shop: organizationShopSchema }),
  });
}
