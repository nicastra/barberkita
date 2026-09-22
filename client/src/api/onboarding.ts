import { z } from 'zod';

import { apiRequest, scopedShopPath } from './client';

const checklistItemSchema = z.object({
  id: z.enum([
    'business_details',
    'first_branch',
    'services',
    'barbers',
    'schedules',
    'public_booking',
  ]),
  label: z.string(),
  complete: z.boolean(),
});

const onboardingChecklistSchema = z.object({
  organizationId: z.string().uuid(),
  shopId: z.string().uuid(),
  complete: z.boolean(),
  items: z.array(checklistItemSchema),
  milestones: z.array(
    z.object({
      id: z.string().uuid(),
      milestone: z.string(),
      completedAt: z.string().datetime({ offset: true }),
    }),
  ),
});

export type OnboardingChecklist = z.infer<typeof onboardingChecklistSchema>;

export function getOnboardingChecklist(signal?: AbortSignal) {
  return apiRequest(scopedShopPath('/onboarding'), {
    schema: z.object({ checklist: onboardingChecklistSchema }),
    signal,
  });
}
