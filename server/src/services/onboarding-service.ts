import { and, count, eq } from 'drizzle-orm';

import type { Database } from '../db/client';
import {
  barberProfiles,
  barberWorkingHours,
  organizationMemberships,
  onboardingMilestones,
  services,
  shops,
} from '../db/schema';

export const onboardingChecklistIds = [
  'business_details',
  'first_branch',
  'services',
  'barbers',
  'schedules',
  'public_booking',
] as const;

export type OnboardingChecklistId = (typeof onboardingChecklistIds)[number];

export type OnboardingChecklist = {
  organizationId: string;
  shopId: string;
  complete: boolean;
  items: Array<{
    id: OnboardingChecklistId;
    label: string;
    complete: boolean;
  }>;
  milestones: Array<{
    id: string;
    milestone: string;
    completedAt: string;
  }>;
};

export interface OnboardingService {
  getChecklist(
    userId: string,
    shopId: string,
  ): Promise<OnboardingChecklist | null>;
}

const labels: Record<OnboardingChecklistId, string> = {
  business_details: 'Complete business details',
  first_branch: 'Set up the first branch',
  services: 'Add at least one service',
  barbers: 'Add at least one barber',
  schedules: 'Configure barber schedules',
  public_booking: 'Enable public booking',
};

export function createOnboardingService(database: Database): OnboardingService {
  return {
    async getChecklist(userId, shopId) {
      const shop = await database
        .select({
          id: shops.id,
          organizationId: shops.organizationId,
          name: shops.name,
          phone: shops.phone,
          email: shops.email,
          address: shops.address,
          timezone: shops.timezone,
          slug: shops.slug,
        })
        .from(shops)
        .innerJoin(
          organizationMemberships,
          and(
            eq(organizationMemberships.organizationId, shops.organizationId),
            eq(organizationMemberships.userId, userId),
            eq(organizationMemberships.active, true),
          ),
        )
        .where(eq(shops.id, shopId))
        .limit(1)
        .then((rows) => rows[0]);
      if (!shop?.organizationId) return null;

      const [serviceCount, barberCount, scheduleCount, branchCount] =
        await Promise.all([
          database
            .select({ count: count() })
            .from(services)
            .where(and(eq(services.shopId, shopId), eq(services.active, true))),
          database
            .select({ count: count() })
            .from(barberProfiles)
            .where(
              and(
                eq(barberProfiles.shopId, shopId),
                eq(barberProfiles.active, true),
              ),
            ),
          database
            .select({ count: count() })
            .from(barberWorkingHours)
            .where(eq(barberWorkingHours.shopId, shopId)),
          database
            .select({ count: count() })
            .from(shops)
            .where(eq(shops.organizationId, shop.organizationId)),
        ]);

      const businessDetails = [
        shop.name,
        shop.phone,
        shop.email,
        shop.address,
        shop.timezone,
      ].every((value) => value.trim().length > 0);
      const servicesReady = Number(serviceCount[0]?.count ?? 0) > 0;
      const barbersReady = Number(barberCount[0]?.count ?? 0) > 0;
      const schedulesReady = Number(scheduleCount[0]?.count ?? 0) > 0;
      const publicBookingReady =
        Boolean(shop.slug) && servicesReady && barbersReady && schedulesReady;
      const completeById: Record<OnboardingChecklistId, boolean> = {
        business_details: businessDetails,
        first_branch: Number(branchCount[0]?.count ?? 0) > 0,
        services: servicesReady,
        barbers: barbersReady,
        schedules: schedulesReady,
        public_booking: publicBookingReady,
      };

      // Milestones are write-once and are derived from persisted configuration;
      // a checklist read can therefore repair a missed event after a migration.
      for (const id of onboardingChecklistIds) {
        if (!completeById[id]) continue;
        await database
          .insert(onboardingMilestones)
          .values({
            organizationId: shop.organizationId,
            shopId,
            milestone: id,
            completedByUserId: userId,
          })
          .onConflictDoNothing({
            target: [
              onboardingMilestones.shopId,
              onboardingMilestones.milestone,
            ],
          });
      }
      const milestones = await database
        .select({
          id: onboardingMilestones.id,
          milestone: onboardingMilestones.milestone,
          completedAt: onboardingMilestones.completedAt,
        })
        .from(onboardingMilestones)
        .where(eq(onboardingMilestones.shopId, shopId));

      return {
        organizationId: shop.organizationId,
        shopId,
        complete: onboardingChecklistIds.every((id) => completeById[id]),
        items: onboardingChecklistIds.map((id) => ({
          id,
          label: labels[id],
          complete: completeById[id],
        })),
        milestones: milestones.map((milestone) => ({
          id: milestone.id,
          milestone: milestone.milestone,
          completedAt: milestone.completedAt.toISOString(),
        })),
      };
    },
  };
}
