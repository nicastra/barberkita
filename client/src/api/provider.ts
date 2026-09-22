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
  onboarding: z.object({ completed: z.number(), total: z.number() }),
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

const providerOrganizationResultSchema = z.object({
  organization: z.object({ id: z.string().uuid() }).passthrough(),
  shop: z.object({ id: z.string().uuid() }).passthrough(),
  subscription: z.object({ id: z.string().uuid() }).passthrough(),
  invitation: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    expiresAt: z.string().datetime({ offset: true }),
  }),
  token: z.string(),
});

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

export function createProviderOrganization(body: unknown) {
  return apiRequest('/api/provider/organizations', {
    method: 'POST',
    body,
    schema: providerOrganizationResultSchema,
  });
}

export function transitionProviderLifecycle(
  organizationId: string,
  lifecycle: ProviderDashboard['organizations'][number]['lifecycle'],
  reason: string,
) {
  return apiRequest(`/api/provider/organizations/${organizationId}/lifecycle`, {
    method: 'PATCH',
    body: { lifecycle, reason },
    schema: z.object({
      organization: z.object({ id: z.string().uuid() }).passthrough(),
      previousLifecycle: z.string(),
    }),
  });
}

export const supportGrantSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  providerUserId: z.string().uuid(),
  requestedByUserId: z.string().uuid(),
  approvedByUserId: z.string().uuid().nullable(),
  reason: z.string(),
  status: z.enum(['pending_approval', 'active', 'revoked', 'expired']),
  breakGlass: z.boolean(),
  expiresAt: z.string().datetime({ offset: true }),
  approvedAt: z.string().datetime({ offset: true }).nullable(),
  revokedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
});
export type SupportGrant = z.infer<typeof supportGrantSchema>;

export function requestSupportGrant(body: {
  organizationId: string;
  reason: string;
  expiresInMinutes: number;
}) {
  return apiRequest('/api/provider/support-grants', {
    method: 'POST',
    body,
    schema: z.object({ grant: supportGrantSchema }),
  });
}

export function createBreakGlassSupportGrant(body: {
  organizationId: string;
  reason: string;
  expiresInMinutes: number;
}) {
  return apiRequest('/api/provider/support-grants/break-glass', {
    method: 'POST',
    body,
    schema: z.object({ grant: supportGrantSchema }),
  });
}

export function listProviderSupportGrants() {
  return apiRequest('/api/provider/support-grants', {
    schema: z.object({ grants: z.array(supportGrantSchema) }),
  });
}

export function authorizeSupportGrant(grantId: string, organizationId: string) {
  return apiRequest(
    `/api/provider/support-grants/${grantId}/authorize/${organizationId}`,
    { schema: z.object({ grant: supportGrantSchema }) },
  );
}

export function revokeSupportGrant(grantId: string) {
  return apiRequest(`/api/provider/support-grants/${grantId}/revoke`, {
    method: 'POST',
    schema: z.object({ grant: supportGrantSchema }),
  });
}
