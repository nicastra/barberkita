import { and, eq, inArray, sql } from 'drizzle-orm';

import type { Database } from '../db/client';
import { withTenantDatabaseContext } from '../db/tenant-context';
import {
  organizationMemberships,
  onboardingMilestones,
  organizations,
  platformAdmins,
  shopMemberships,
  shops,
  sessions,
  tenantAuditLogs,
  users,
} from '../db/schema';

export type OrganizationRole =
  'organization_owner' | 'organization_admin' | 'organization_member';
export type ShopRole = 'shop_manager' | 'receptionist' | 'barber';
export type OrganizationLifecycle =
  'trialing' | 'active' | 'suspended' | 'archived';

export class LifecycleDomainError extends Error {
  public constructor(
    public readonly code:
      'ORGANIZATION_NOT_FOUND' | 'INVALID_LIFECYCLE_TRANSITION',
    message: string,
  ) {
    super(message);
  }
}

export interface TenantContext {
  userId: string;
  organizationId: string;
  shopId: string;
  organizationRole: OrganizationRole;
  shopRole: ShopRole;
  organizationLifecycle: 'trialing' | 'active' | 'suspended' | 'archived';
}

export interface TenantMembershipView {
  organizationId: string;
  organizationName: string;
  organizationRole: OrganizationRole;
  organizationLifecycle: 'trialing' | 'active' | 'suspended' | 'archived';
  shopId: string;
  shopSlug: string | null;
  shopName: string;
  shopRole: ShopRole;
}

export interface OrganizationView {
  id: string;
  name: string;
  slug: string;
  lifecycle: 'trialing' | 'active' | 'suspended' | 'archived';
  role: OrganizationRole;
}

export interface OrganizationShopView {
  id: string;
  slug: string | null;
  name: string;
  phone: string;
  email: string;
  address: string;
  timezone: string;
}

export interface TenantService {
  resolve(userId: string, shopId: string): Promise<TenantContext | null>;
  list(userId: string): Promise<TenantMembershipView[]>;
  getOrganization(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationView | null>;
  listOrganizationShops(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationShopView[] | null>;
  createOrganizationShop?(
    actorUserId: string,
    organizationId: string,
    input: {
      slug: string;
      name: string;
      phone: string;
      email: string;
      address: string;
      timezone: string;
    },
  ): Promise<OrganizationShopView | null>;
  isPlatformAdmin(userId: string): Promise<boolean>;
  updateMembership?(
    actorUserId: string,
    organizationId: string,
    input: {
      userId: string;
      shopId: string;
      active?: boolean | undefined;
      organizationRole?: OrganizationRole | undefined;
      shopRole?: ShopRole | undefined;
    },
  ): Promise<boolean>;
  transitionLifecycle?(
    actorUserId: string,
    organizationId: string,
    nextLifecycle: OrganizationLifecycle,
    reason: string,
  ): Promise<{
    organization: typeof organizations.$inferSelect;
    previousLifecycle: OrganizationLifecycle;
  }>;
}

export function createTenantService(database: Database): TenantService {
  return {
    async resolve(userId, shopId) {
      const row = await withTenantDatabaseContext(
        database,
        { userId, shopId },
        async (transaction) =>
          transaction
            .select({
              organizationId: organizations.id,
              shopId: shops.id,
              organizationRole: organizationMemberships.role,
              shopRole: shopMemberships.role,
              organizationLifecycle: organizations.lifecycle,
            })
            .from(shopMemberships)
            .innerJoin(users, eq(shopMemberships.userId, users.id))
            .innerJoin(shops, eq(shopMemberships.shopId, shops.id))
            .innerJoin(
              organizations,
              eq(shops.organizationId, organizations.id),
            )
            .innerJoin(
              organizationMemberships,
              and(
                eq(organizationMemberships.organizationId, organizations.id),
                eq(organizationMemberships.userId, userId),
              ),
            )
            .where(
              and(
                eq(shopMemberships.userId, userId),
                eq(shopMemberships.shopId, shopId),
                eq(shopMemberships.active, true),
                eq(organizationMemberships.active, true),
                eq(users.active, true),
                inArray(organizations.lifecycle, [
                  'trialing',
                  'active',
                  'suspended',
                ]),
              ),
            )
            .limit(1)
            .then((rows) => rows[0]),
      );

      if (!row || !row.organizationId) return null;
      return {
        userId,
        organizationId: row.organizationId,
        shopId: row.shopId,
        organizationRole: row.organizationRole,
        shopRole: row.shopRole,
        organizationLifecycle: row.organizationLifecycle,
      };
    },
    async list(userId) {
      return withTenantDatabaseContext(database, { userId }, (transaction) =>
        transaction
          .select({
            organizationId: organizations.id,
            organizationName: organizations.name,
            organizationRole: organizationMemberships.role,
            organizationLifecycle: organizations.lifecycle,
            shopId: shops.id,
            shopSlug: shops.slug,
            shopName: shops.name,
            shopRole: shopMemberships.role,
          })
          .from(shopMemberships)
          .innerJoin(users, eq(shopMemberships.userId, users.id))
          .innerJoin(shops, eq(shopMemberships.shopId, shops.id))
          .innerJoin(organizations, eq(shops.organizationId, organizations.id))
          .innerJoin(
            organizationMemberships,
            and(
              eq(organizationMemberships.organizationId, organizations.id),
              eq(organizationMemberships.userId, userId),
            ),
          )
          .where(
            and(
              eq(shopMemberships.userId, userId),
              eq(shopMemberships.active, true),
              eq(organizationMemberships.active, true),
              eq(users.active, true),
              inArray(organizations.lifecycle, [
                'trialing',
                'active',
                'suspended',
              ]),
            ),
          )
          .orderBy(organizations.name, shops.name),
      );
    },
    async getOrganization(userId, organizationId) {
      return withTenantDatabaseContext(
        database,
        { userId, organizationId },
        async (transaction) => {
          const row = await transaction
            .select({
              id: organizations.id,
              name: organizations.name,
              slug: organizations.slug,
              lifecycle: organizations.lifecycle,
              role: organizationMemberships.role,
            })
            .from(organizationMemberships)
            .innerJoin(
              organizations,
              eq(organizationMemberships.organizationId, organizations.id),
            )
            .innerJoin(users, eq(organizationMemberships.userId, users.id))
            .where(
              and(
                eq(organizationMemberships.organizationId, organizationId),
                eq(organizationMemberships.userId, userId),
                eq(organizationMemberships.active, true),
                eq(users.active, true),
                inArray(organizations.lifecycle, [
                  'trialing',
                  'active',
                  'suspended',
                ]),
              ),
            )
            .limit(1)
            .then((rows) => rows[0]);
          return row ?? null;
        },
      );
    },
    async listOrganizationShops(userId, organizationId) {
      return withTenantDatabaseContext(
        database,
        { userId, organizationId },
        async (transaction) => {
          const membership = await transaction
            .select({ id: organizationMemberships.userId })
            .from(organizationMemberships)
            .innerJoin(users, eq(organizationMemberships.userId, users.id))
            .innerJoin(
              organizations,
              eq(organizationMemberships.organizationId, organizations.id),
            )
            .where(
              and(
                eq(organizationMemberships.organizationId, organizationId),
                eq(organizationMemberships.userId, userId),
                eq(organizationMemberships.active, true),
                eq(users.active, true),
                inArray(organizations.lifecycle, [
                  'trialing',
                  'active',
                  'suspended',
                ]),
              ),
            )
            .limit(1)
            .then((rows) => rows[0]);
          if (!membership) return null;
          return transaction
            .select({
              id: shops.id,
              slug: shops.slug,
              name: shops.name,
              phone: shops.phone,
              email: shops.email,
              address: shops.address,
              timezone: shops.timezone,
            })
            .from(shops)
            .where(eq(shops.organizationId, organizationId))
            .orderBy(shops.name);
        },
      );
    },
    async createOrganizationShop(actorUserId, organizationId, input) {
      return database.transaction(async (transaction) => {
        const membership = await transaction
          .select({ role: organizationMemberships.role })
          .from(organizationMemberships)
          .innerJoin(
            organizations,
            eq(organizations.id, organizationMemberships.organizationId),
          )
          .where(
            and(
              eq(organizationMemberships.organizationId, organizationId),
              eq(organizationMemberships.userId, actorUserId),
              eq(organizationMemberships.active, true),
              inArray(organizations.lifecycle, ['trialing', 'active']),
            ),
          )
          .limit(1)
          .then((rows) => rows[0]);
        if (
          !membership ||
          !['organization_owner', 'organization_admin'].includes(
            membership.role,
          )
        )
          return null;
        const existingBranches = await transaction
          .select({ id: shops.id })
          .from(shops)
          .where(eq(shops.organizationId, organizationId));
        const isFirstBranch = existingBranches.length === 0;
        const [shop] = await transaction
          .insert(shops)
          .values({
            organizationId,
            ...input,
            email: input.email.toLowerCase(),
          })
          .returning();
        if (!shop) return null;
        await transaction.insert(shopMemberships).values({
          organizationId,
          shopId: shop.id,
          userId: actorUserId,
          role: 'shop_manager',
          active: true,
        });
        await transaction.insert(tenantAuditLogs).values({
          organizationId,
          shopId: shop.id,
          actorUserId,
          action: isFirstBranch ? 'first_branch_created' : 'branch_created',
          metadata: { slug: shop.slug },
        });
        if (isFirstBranch)
          await transaction
            .insert(onboardingMilestones)
            .values({
              organizationId,
              shopId: shop.id,
              milestone: 'first_branch_created',
              completedByUserId: actorUserId,
            })
            .onConflictDoNothing({
              target: [
                onboardingMilestones.shopId,
                onboardingMilestones.milestone,
              ],
            });
        return {
          id: shop.id,
          slug: shop.slug,
          name: shop.name,
          phone: shop.phone,
          email: shop.email,
          address: shop.address,
          timezone: shop.timezone,
        };
      });
    },
    async isPlatformAdmin(userId) {
      const row = await withTenantDatabaseContext(
        database,
        { userId },
        (transaction) =>
          transaction
            .select({ userId: platformAdmins.userId })
            .from(platformAdmins)
            .innerJoin(users, eq(platformAdmins.userId, users.id))
            .where(
              and(eq(platformAdmins.userId, userId), eq(users.active, true)),
            )
            .limit(1)
            .then((rows) => rows[0]),
      );
      return Boolean(row);
    },
    async transitionLifecycle(
      actorUserId,
      organizationId,
      nextLifecycle,
      reason,
    ) {
      return database.transaction(async (transaction) => {
        const current = await transaction
          .select()
          .from(organizations)
          .where(eq(organizations.id, organizationId))
          .for('update')
          .limit(1)
          .then((rows) => rows[0]);
        if (!current)
          throw new LifecycleDomainError(
            'ORGANIZATION_NOT_FOUND',
            'Organization not found.',
          );

        const allowedTransitions: Record<
          OrganizationLifecycle,
          OrganizationLifecycle[]
        > = {
          trialing: ['active', 'suspended', 'archived'],
          active: ['suspended', 'archived'],
          suspended: ['active', 'archived'],
          archived: [],
        };
        if (
          current.lifecycle !== nextLifecycle &&
          !allowedTransitions[current.lifecycle].includes(nextLifecycle)
        )
          throw new LifecycleDomainError(
            'INVALID_LIFECYCLE_TRANSITION',
            `Cannot transition an ${current.lifecycle} organization to ${nextLifecycle}.`,
          );

        if (current.lifecycle === nextLifecycle)
          return {
            organization: current,
            previousLifecycle: current.lifecycle,
          };

        const [organization] = await transaction
          .update(organizations)
          .set({ lifecycle: nextLifecycle, updatedAt: new Date() })
          .where(eq(organizations.id, organizationId))
          .returning();
        if (!organization)
          throw new LifecycleDomainError(
            'ORGANIZATION_NOT_FOUND',
            'Organization not found.',
          );
        await transaction.insert(tenantAuditLogs).values({
          organizationId,
          actorUserId,
          action: 'organization_lifecycle_changed',
          reason,
          metadata: {
            previousLifecycle: current.lifecycle,
            nextLifecycle,
          },
        });
        return { organization, previousLifecycle: current.lifecycle };
      });
    },
    async updateMembership(actorUserId, organizationId, input) {
      return database.transaction(async (transaction) => {
        const actor = await transaction
          .select({ role: organizationMemberships.role })
          .from(organizationMemberships)
          .where(
            and(
              eq(organizationMemberships.organizationId, organizationId),
              eq(organizationMemberships.userId, actorUserId),
              eq(organizationMemberships.active, true),
            ),
          )
          .limit(1)
          .then((rows) => rows[0]);
        if (
          !actor ||
          !['organization_owner', 'organization_admin'].includes(actor.role)
        )
          return false;
        // Administrators may manage ordinary members, but cannot grant or
        // modify organization administration/ownership privileges.
        if (
          actor.role === 'organization_admin' &&
          (input.organizationRole === 'organization_owner' ||
            input.organizationRole === 'organization_admin' ||
            input.shopRole === 'shop_manager')
        )
          return false;
        if (
          input.organizationRole === 'organization_owner' &&
          actor.role !== 'organization_owner'
        )
          return false;
        const target = await transaction
          .select({
            userId: organizationMemberships.userId,
            role: organizationMemberships.role,
            active: organizationMemberships.active,
          })
          .from(organizationMemberships)
          .innerJoin(
            shopMemberships,
            and(
              eq(shopMemberships.userId, organizationMemberships.userId),
              eq(shopMemberships.organizationId, organizationId),
              eq(shopMemberships.shopId, input.shopId),
            ),
          )
          .where(
            and(
              eq(organizationMemberships.organizationId, organizationId),
              eq(organizationMemberships.userId, input.userId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0]);
        if (!target) return false;
        const remainingMemberships = await transaction
          .select({ count: sql<number>`count(*)` })
          .from(shopMemberships)
          .where(
            and(
              eq(shopMemberships.organizationId, organizationId),
              eq(shopMemberships.userId, input.userId),
              eq(shopMemberships.active, true),
              sql`${shopMemberships.shopId} <> ${input.shopId}`,
            ),
          );
        const hasOtherActiveShop =
          Number(remainingMemberships[0]?.count ?? 0) > 0;
        const removesOwner =
          target.role === 'organization_owner' &&
          target.active &&
          ((input.active === false && !hasOtherActiveShop) ||
            (input.organizationRole !== undefined &&
              input.organizationRole !== 'organization_owner'));
        if (removesOwner) {
          if (actor.role !== 'organization_owner') return false;
          const [ownerCount] = await transaction
            .select({ count: sql<number>`count(*)` })
            .from(organizationMemberships)
            .where(
              and(
                eq(organizationMemberships.organizationId, organizationId),
                eq(organizationMemberships.role, 'organization_owner'),
                eq(organizationMemberships.active, true),
              ),
            );
          if (Number(ownerCount?.count ?? 0) <= 1) return false;
        }
        const now = new Date();
        const organizationUpdate: Partial<
          typeof organizationMemberships.$inferInsert
        > = { updatedAt: now };
        if (input.organizationRole !== undefined)
          organizationUpdate.role = input.organizationRole;
        // A branch removal must not remove the user's access to every other
        // branch in the organization. Deactivate the organization membership
        // only when no active shop memberships remain after this change.
        if (input.active === true) organizationUpdate.active = true;
        if (input.active === false) {
          if (!hasOtherActiveShop) organizationUpdate.active = false;
        }
        await transaction
          .update(organizationMemberships)
          .set(organizationUpdate)
          .where(
            and(
              eq(organizationMemberships.organizationId, organizationId),
              eq(organizationMemberships.userId, input.userId),
            ),
          );
        await transaction
          .update(shopMemberships)
          .set({
            ...(input.shopRole ? { role: input.shopRole } : {}),
            active: input.active ?? true,
            updatedAt: now,
          })
          .where(
            and(
              eq(shopMemberships.organizationId, organizationId),
              eq(shopMemberships.shopId, input.shopId),
              eq(shopMemberships.userId, input.userId),
            ),
          );
        await transaction
          .delete(sessions)
          .where(eq(sessions.userId, input.userId));
        await transaction.insert(tenantAuditLogs).values({
          organizationId,
          shopId: input.shopId,
          actorUserId: actorUserId,
          action:
            input.active === false
              ? 'membership_removed'
              : input.organizationRole === 'organization_owner' ||
                  target.role === 'organization_owner'
                ? 'ownership_changed'
                : 'membership_changed',
          metadata: {
            targetUserId: input.userId,
            organizationRole: input.organizationRole,
            shopRole: input.shopRole,
          },
        });
        return true;
      });
    },
  };
}
