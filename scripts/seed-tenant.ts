import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { createDatabase, type Database } from '../server/src/db/client';
import {
  organizationMemberships,
  organizations,
  platformAdmins,
  shopMemberships,
  shops,
  users,
} from '../server/src/db/schema';

type SeedTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const environmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  TENANT_SEED_ORGANIZATION_NAME: z
    .string()
    .trim()
    .min(1)
    .default('Phase 10 Pilot'),
  TENANT_SEED_ORGANIZATION_SLUG: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .default('phase-10-pilot'),
  TENANT_SEED_LIFECYCLE: z
    .enum(['trialing', 'active', 'suspended', 'archived'])
    .default('trialing'),
  TENANT_SEED_SHOP_NAME: z
    .string()
    .trim()
    .min(1)
    .default('Phase 10 Pilot Shop'),
  TENANT_SEED_SHOP_SLUG: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .default('phase-10-pilot-shop'),
  TENANT_SEED_OWNER_NAME: z.string().trim().min(1).default('Pilot Owner'),
  TENANT_SEED_OWNER_EMAIL: z
    .string()
    .email()
    .default('pilot-owner@cukurpro.local'),
  TENANT_SEED_OWNER_PASSWORD: z
    .string()
    .min(12)
    .default('PilotOwnerPassword123!'),
  TENANT_SEED_PROVIDER_NAME: z
    .string()
    .trim()
    .min(1)
    .default('CukurPro Provider'),
  TENANT_SEED_PROVIDER_EMAIL: z
    .string()
    .email()
    .default('provider-admin@cukurpro.local'),
  TENANT_SEED_PROVIDER_PASSWORD: z
    .string()
    .min(12)
    .default('ProviderPassword123!'),
});

type SeedConfig = z.infer<typeof environmentSchema>;

async function upsertUser(
  tx: SeedTransaction,
  input: { name: string; email: string; password: string },
) {
  const passwordHash = await Bun.password.hash(input.password);
  const [user] = await tx
    .insert(users)
    .values({
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      active: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: input.name,
        passwordHash,
        active: true,
        updatedAt: new Date(),
      },
    })
    .returning({ id: users.id });
  if (!user) throw new Error(`Could not seed ${input.email}.`);
  return user.id;
}

async function seed(config: SeedConfig) {
  const { client, database } = createDatabase(config.DATABASE_URL);
  try {
    const result = await database.transaction(async (tx) => {
      const [organization] = await tx
        .insert(organizations)
        .values({
          name: config.TENANT_SEED_ORGANIZATION_NAME,
          slug: config.TENANT_SEED_ORGANIZATION_SLUG,
          lifecycle: config.TENANT_SEED_LIFECYCLE,
        })
        .onConflictDoUpdate({
          target: organizations.slug,
          set: {
            name: config.TENANT_SEED_ORGANIZATION_NAME,
            lifecycle: config.TENANT_SEED_LIFECYCLE,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!organization) throw new Error('Could not seed the organization.');

      const [existingShop] = await tx
        .select()
        .from(shops)
        .where(eq(shops.slug, config.TENANT_SEED_SHOP_SLUG))
        .limit(1);
      if (existingShop && existingShop.organizationId !== organization.id)
        throw new Error(
          `Shop slug ${config.TENANT_SEED_SHOP_SLUG} already belongs to another organization.`,
        );
      const [shop] = existingShop
        ? await tx
            .update(shops)
            .set({
              organizationId: organization.id,
              name: config.TENANT_SEED_SHOP_NAME,
              phone: '+62 21 555 0110',
              email: 'pilot-shop@cukurpro.local',
              address: 'Jl. Pilot No. 10, Jakarta',
              timezone: 'Asia/Jakarta',
              updatedAt: new Date(),
            })
            .where(eq(shops.id, existingShop.id))
            .returning()
        : await tx
            .insert(shops)
            .values({
              organizationId: organization.id,
              slug: config.TENANT_SEED_SHOP_SLUG,
              name: config.TENANT_SEED_SHOP_NAME,
              phone: '+62 21 555 0110',
              email: 'pilot-shop@cukurpro.local',
              address: 'Jl. Pilot No. 10, Jakarta',
              timezone: 'Asia/Jakarta',
            })
            .returning();
      if (!shop) throw new Error('Could not seed the shop.');

      const ownerId = await upsertUser(tx, {
        name: config.TENANT_SEED_OWNER_NAME,
        email: config.TENANT_SEED_OWNER_EMAIL,
        password: config.TENANT_SEED_OWNER_PASSWORD,
      });
      await tx
        .insert(organizationMemberships)
        .values({
          organizationId: organization.id,
          userId: ownerId,
          role: 'organization_owner',
          active: true,
        })
        .onConflictDoUpdate({
          target: [
            organizationMemberships.organizationId,
            organizationMemberships.userId,
          ],
          set: {
            role: 'organization_owner',
            active: true,
            updatedAt: new Date(),
          },
        });
      await tx
        .insert(shopMemberships)
        .values({
          organizationId: organization.id,
          shopId: shop.id,
          userId: ownerId,
          role: 'shop_manager',
          active: true,
        })
        .onConflictDoUpdate({
          target: [shopMemberships.shopId, shopMemberships.userId],
          set: {
            organizationId: organization.id,
            role: 'shop_manager',
            active: true,
          },
        });

      const providerId = await upsertUser(tx, {
        name: config.TENANT_SEED_PROVIDER_NAME,
        email: config.TENANT_SEED_PROVIDER_EMAIL,
        password: config.TENANT_SEED_PROVIDER_PASSWORD,
      });
      await tx
        .insert(platformAdmins)
        .values({ userId: providerId })
        .onConflictDoNothing();

      return { organizationId: organization.id, shopId: shop.id };
    });
    console.log(
      JSON.stringify(
        {
          ...result,
          lifecycle: config.TENANT_SEED_LIFECYCLE,
          owner: {
            email: config.TENANT_SEED_OWNER_EMAIL,
            password: config.TENANT_SEED_OWNER_PASSWORD,
          },
          providerAdmin: {
            email: config.TENANT_SEED_PROVIDER_EMAIL,
            password: config.TENANT_SEED_PROVIDER_PASSWORD,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

await seed(environmentSchema.parse(process.env));
