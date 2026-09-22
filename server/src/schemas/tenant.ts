import { z } from 'zod';

import { timezoneSchema } from './shop';

export const tenantShopParamsSchema = z.object({
  shopId: z.string().uuid(),
});

export const tenantOrganizationParamsSchema = z.object({
  organizationId: z.string().uuid(),
});

export const tenantMembershipParamsSchema =
  tenantOrganizationParamsSchema.extend({
    userId: z.string().uuid(),
  });

export const updateMembershipSchema = z
  .object({
    shopId: z.string().uuid(),
    active: z.boolean().optional(),
    organizationRole: z
      .enum(['organization_owner', 'organization_admin', 'organization_member'])
      .optional(),
    shopRole: z.enum(['shop_manager', 'receptionist', 'barber']).optional(),
  })
  .refine(
    (value) =>
      value.active !== undefined ||
      value.organizationRole !== undefined ||
      value.shopRole !== undefined,
    'At least one membership field is required.',
  );

export const publicShopParamsSchema = z.object({
  shopSlug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const providerOrganizationCreateSchema = z.object({
  organization: z.object({
    name: z.string().trim().min(1).max(160),
    slug: slugSchema,
    lifecycle: z.enum(['trialing', 'active']).default('trialing'),
  }),
  shop: z.object({
    name: z.string().trim().min(1).max(160),
    slug: slugSchema,
    phone: z.string().trim().min(1).max(40),
    email: z.string().trim().email().max(254),
    address: z.string().trim().min(1).max(500),
    timezone: timezoneSchema.default('Asia/Jakarta'),
  }),
  owner: z.object({
    email: z.string().trim().email().max(254),
    expiresInHours: z.number().int().min(1).max(168).default(72),
  }),
});

export const providerLifecycleUpdateSchema = z.object({
  lifecycle: z.enum(['trialing', 'active', 'suspended', 'archived']),
  reason: z.string().trim().min(1).max(500),
});

export const createOrganizationShopSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(1).max(40),
  email: z.string().trim().email().max(320),
  address: z.string().trim().min(1).max(500),
  timezone: timezoneSchema.default('Asia/Jakarta'),
});

export const supportGrantIdSchema = z.object({
  grantId: z.string().uuid(),
});

export const supportGrantOrganizationParamsSchema = supportGrantIdSchema.extend(
  {
    organizationId: z.string().uuid(),
  },
);

export const supportGrantRequestSchema = z.object({
  organizationId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
  expiresInMinutes: z.number().int().min(1).max(1_440).default(60),
});

export const breakGlassSupportGrantSchema = supportGrantRequestSchema.extend({
  expiresInMinutes: z.number().int().min(1).max(60).default(15),
});
