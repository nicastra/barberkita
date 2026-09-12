import { z } from 'zod';

import { apiRequest } from './client';

const providerBranchSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string().nullable(),
});

const providerOrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  lifecycle: z.enum(['trialing', 'active', 'suspended', 'archived']),
  subscriptionStatus: z.enum(['trialing', 'active', 'suspended', 'archived']),
  plan: z.null(),
  entitlements: z.array(z.string()),
  counts: z.object({ activeUsers: z.number(), shops: z.number() }),
  branches: z.array(providerBranchSchema),
});

const providerDashboardSchema = z.object({
  organizations: z.array(providerOrganizationSchema),
  recentActivity: z.array(
    z.object({
      action: z.string(),
      organizationId: z.string().uuid().nullable(),
      shopId: z.string().uuid().nullable(),
      occurredAt: z.string().datetime({ offset: true }),
    }),
  ),
  health: z.object({
    status: z.literal('ok'),
    checks: z.object({ database: z.literal('ok') }),
  }),
});

export type ProviderDashboard = z.infer<typeof providerDashboardSchema>;

export function getProviderMe() {
  return apiRequest('/api/provider/me', {
    schema: z.object({
      provider: z.object({
        userId: z.string().uuid(),
        role: z.literal('platform_admin'),
      }),
    }),
  });
}

export function getProviderDashboard(signal?: AbortSignal) {
  return apiRequest('/api/provider/dashboard', {
    schema: providerDashboardSchema,
    signal,
  });
}
