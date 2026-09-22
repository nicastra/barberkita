import { and, count, countDistinct, desc, eq } from 'drizzle-orm';

import type { Database } from '../db/client';
import {
  organizationMemberships,
  organizationSubscriptions,
  organizations,
  onboardingMilestones,
  platformAdmins,
  shops,
  tenantAuditLogs,
  users,
} from '../db/schema';

export type ProviderDashboard = {
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    lifecycle: 'trialing' | 'active' | 'suspended' | 'archived';
    subscriptionStatus: 'trialing' | 'active' | 'suspended' | 'archived';
    plan: null;
    entitlements: string[];
    counts: { activeUsers: number; shops: number };
    onboarding: { completed: number; total: number };
    branches: Array<{ id: string; name: string; slug: string | null }>;
  }>;
  recentActivity: Array<{
    action: string;
    organizationId: string | null;
    shopId: string | null;
    occurredAt: string;
  }>;
  health: {
    status: 'ok';
    checks: { database: 'ok' };
  };
};

export interface ProviderDashboardService {
  getDashboard(): Promise<ProviderDashboard>;
}

/**
 * Read-only, metadata-first provider reporting. Operational tenant records
 * (customers, bookings, payments, and revenue) are intentionally not queried.
 */
export function createProviderDashboardService(
  database: Database,
): ProviderDashboardService {
  return {
    async getDashboard() {
      // Subscription metadata is additive in Phase 10. Keep the metadata
      // console readable during a rolling deployment where the API may start
      // before migration 0016 has reached the database.
      const subscriptionQuery = database
        .select({
          organizationId: organizationSubscriptions.organizationId,
          status: organizationSubscriptions.status,
        })
        .from(organizationSubscriptions)
        .catch(
          () =>
            [] as Array<{
              organizationId: string;
              status: 'trialing' | 'active' | 'suspended' | 'archived';
            }>,
        );
      const [
        organizationRows,
        shopRows,
        userCounts,
        shopCounts,
        milestoneCounts,
        subscriptionRows,
        activity,
      ] = await Promise.all([
        database
          .select({
            id: organizations.id,
            name: organizations.name,
            slug: organizations.slug,
            lifecycle: organizations.lifecycle,
          })
          .from(organizations)
          .orderBy(organizations.name),
        database
          .select({
            id: shops.id,
            organizationId: shops.organizationId,
            name: shops.name,
            slug: shops.slug,
          })
          .from(shops)
          .orderBy(shops.name),
        database
          .select({
            organizationId: organizationMemberships.organizationId,
            count: countDistinct(organizationMemberships.userId),
          })
          .from(organizationMemberships)
          .innerJoin(users, eq(organizationMemberships.userId, users.id))
          .where(
            and(
              eq(organizationMemberships.active, true),
              eq(users.active, true),
            ),
          )
          .groupBy(organizationMemberships.organizationId),
        database
          .select({
            organizationId: shops.organizationId,
            count: count(shops.id),
          })
          .from(shops)
          .groupBy(shops.organizationId),
        database
          .select({
            organizationId: onboardingMilestones.organizationId,
            count: count(onboardingMilestones.id),
          })
          .from(onboardingMilestones)
          .groupBy(onboardingMilestones.organizationId),
        subscriptionQuery,
        database
          .select({
            action: tenantAuditLogs.action,
            organizationId: tenantAuditLogs.organizationId,
            shopId: tenantAuditLogs.shopId,
            occurredAt: tenantAuditLogs.createdAt,
          })
          .from(tenantAuditLogs)
          .innerJoin(
            platformAdmins,
            eq(tenantAuditLogs.actorUserId, platformAdmins.userId),
          )
          .orderBy(desc(tenantAuditLogs.createdAt))
          .limit(20),
      ]);

      const usersByOrganization = new Map(
        userCounts.map((row) => [row.organizationId, Number(row.count)]),
      );
      const shopsByOrganization = new Map(
        shopCounts.map((row) => [row.organizationId, Number(row.count)]),
      );
      const milestonesByOrganization = new Map(
        milestoneCounts.map((row) => [row.organizationId, Number(row.count)]),
      );
      const subscriptionsByOrganization = new Map(
        subscriptionRows.map((row) => [row.organizationId, row.status]),
      );
      const branchesByOrganization = new Map<
        string,
        Array<{ id: string; name: string; slug: string | null }>
      >();
      for (const shop of shopRows) {
        if (!shop.organizationId) continue;
        const branches = branchesByOrganization.get(shop.organizationId) ?? [];
        branches.push({ id: shop.id, name: shop.name, slug: shop.slug });
        branchesByOrganization.set(shop.organizationId, branches);
      }

      return {
        organizations: organizationRows.map((organization) => ({
          ...organization,
          subscriptionStatus:
            subscriptionsByOrganization.get(organization.id) ??
            organization.lifecycle,
          // Plans and entitlements are introduced in Phase 11. Returning an
          // explicit empty shape keeps this endpoint stable during Phase 10.
          plan: null,
          entitlements: [],
          counts: {
            activeUsers: usersByOrganization.get(organization.id) ?? 0,
            shops: shopsByOrganization.get(organization.id) ?? 0,
          },
          onboarding: {
            completed: milestonesByOrganization.get(organization.id) ?? 0,
            total: 6,
          },
          branches: branchesByOrganization.get(organization.id) ?? [],
        })),
        recentActivity: activity.map((entry) => ({
          action: entry.action,
          organizationId: entry.organizationId,
          shopId: entry.shopId,
          occurredAt: entry.occurredAt.toISOString(),
        })),
        health: { status: 'ok' as const, checks: { database: 'ok' as const } },
      };
    },
  };
}
