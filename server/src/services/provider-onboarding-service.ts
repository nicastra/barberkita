import { randomBytes } from 'node:crypto';
import type { Database } from '../db/client';
import {
  invitations,
  onboardingMilestones,
  organizationSubscriptions,
  organizations,
  platformAdmins,
  shops,
  tenantAuditLogs,
  users,
} from '../db/schema';
import { and, eq } from 'drizzle-orm';
import { hashToken } from './auth-service';

export interface ProviderOnboardingInput {
  organization: {
    name: string;
    slug: string;
    lifecycle: 'trialing' | 'active';
  };
  shop: {
    name: string;
    slug: string;
    phone: string;
    email: string;
    address: string;
    timezone: string;
  };
  owner: { email: string; expiresInHours: number };
}
export class ProviderOnboardingError extends Error {
  public constructor(
    public readonly code: 'PROVIDER_ACCESS_DENIED',
    message: string,
  ) {
    super(message);
  }
}
export interface ProviderOnboardingService {
  createOrganization(
    actorUserId: string,
    input: ProviderOnboardingInput,
  ): Promise<{
    organization: typeof organizations.$inferSelect;
    shop: typeof shops.$inferSelect;
    subscription: typeof organizationSubscriptions.$inferSelect;
    invitation: { id: string; email: string; expiresAt: Date };
    token: string;
  }>;
}

export function createProviderOnboardingService(
  database: Database,
): ProviderOnboardingService {
  return {
    async createOrganization(actorUserId, input) {
      const token = randomBytes(32).toString('base64url');
      return database.transaction(async (tx) => {
        const provider = await tx
          .select({ userId: platformAdmins.userId })
          .from(platformAdmins)
          .innerJoin(users, eq(platformAdmins.userId, users.id))
          .where(
            and(eq(platformAdmins.userId, actorUserId), eq(users.active, true)),
          )
          .limit(1)
          .then((rows) => rows[0]);
        if (!provider)
          throw new ProviderOnboardingError(
            'PROVIDER_ACCESS_DENIED',
            'Platform administrator access is required.',
          );
        const [organization] = await tx
          .insert(organizations)
          .values({
            name: input.organization.name,
            slug: input.organization.slug,
            lifecycle: input.organization.lifecycle,
          })
          .returning();
        if (!organization) throw new Error('Organization onboarding failed.');
        const trialStartedAt = new Date();
        const [subscription] = await tx
          .insert(organizationSubscriptions)
          .values({
            organizationId: organization.id,
            status:
              input.organization.lifecycle === 'active' ? 'active' : 'trialing',
            trialStartedAt,
            trialEndsAt: new Date(
              trialStartedAt.getTime() + 14 * 24 * 3_600_000,
            ),
          })
          .returning();
        if (!subscription)
          throw new Error('Trial subscription initialization failed.');
        const [shop] = await tx
          .insert(shops)
          .values({
            organizationId: organization.id,
            ...input.shop,
            email: input.shop.email.toLowerCase(),
          })
          .returning();
        if (!shop) throw new Error('Branch onboarding failed.');
        const [invitation] = await tx
          .insert(invitations)
          .values({
            organizationId: organization.id,
            shopId: shop.id,
            email: input.owner.email.toLowerCase(),
            organizationRole: 'organization_owner',
            shopRole: 'shop_manager',
            tokenHash: hashToken(token),
            expiresAt: new Date(
              Date.now() + input.owner.expiresInHours * 3_600_000,
            ),
            invitedByUserId: actorUserId,
          })
          .returning();
        if (!invitation) throw new Error('Owner invitation failed.');
        await tx.insert(tenantAuditLogs).values({
          organizationId: organization.id,
          shopId: shop.id,
          actorUserId,
          action: 'provider_organization_approved',
          metadata: {
            invitationId: invitation.id,
            ownerEmail: invitation.email,
            lifecycle: organization.lifecycle,
          },
        });
        await tx.insert(onboardingMilestones).values([
          {
            organizationId: organization.id,
            shopId: shop.id,
            milestone: 'organization_approved',
            completedByUserId: actorUserId,
          },
          {
            organizationId: organization.id,
            shopId: shop.id,
            milestone: 'trial_initialized',
            completedByUserId: actorUserId,
          },
          {
            organizationId: organization.id,
            shopId: shop.id,
            milestone: 'owner_invited',
            completedByUserId: actorUserId,
          },
          {
            organizationId: organization.id,
            shopId: shop.id,
            milestone: 'first_branch_created',
            completedByUserId: actorUserId,
          },
        ]);
        await tx.insert(tenantAuditLogs).values([
          {
            organizationId: organization.id,
            shopId: shop.id,
            actorUserId: actorUserId,
            action: 'subscription_trial_initialized',
            metadata: {
              subscriptionId: subscription.id,
              trialEndsAt: subscription.trialEndsAt.toISOString(),
            },
          },
          {
            organizationId: organization.id,
            shopId: shop.id,
            actorUserId: actorUserId,
            action: 'owner_invitation_sent',
            metadata: { invitationId: invitation.id },
          },
        ]);
        return {
          organization,
          shop,
          subscription,
          invitation: {
            id: invitation.id,
            email: invitation.email,
            expiresAt: invitation.expiresAt,
          },
          token,
        };
      });
    },
  };
}
