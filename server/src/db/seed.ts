import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createDatabase, type Database } from './client';
import {
  organizationMemberships,
  organizations,
  shopMemberships,
  shops,
  users,
} from './schema';

type SeedTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];
const seedEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  SEED_SHOP_NAME: z.string().trim().min(1).default('CukurPro Demo Shop'),
  SEED_SHOP_PHONE: z.string().trim().min(1).default('+62 21 555 0100'),
  SEED_SHOP_EMAIL: z.string().email().default('demo@cukurpro.local'),
  SEED_SHOP_ADDRESS: z
    .string()
    .trim()
    .min(1)
    .default('Jl. Demo No. 1, Jakarta'),
  SEED_SHOP_TIMEZONE: z.string().trim().min(1).default('Asia/Jakarta'),
  SEED_OWNER_NAME: z.string().trim().min(1).default('Demo Owner'),
  SEED_OWNER_EMAIL: z.string().email().default('owner@cukurpro.local'),
  SEED_OWNER_PASSWORD: z.string().min(12).default('OwnerPassword123!'),
  SEED_STAFF_NAME: z.string().trim().min(1).default('Demo Barber'),
  SEED_STAFF_EMAIL: z.string().email().default('staff@cukurpro.local'),
  SEED_STAFF_PASSWORD: z.string().min(12).default('StaffPassword123!'),
  SEED_SECOND_STAFF_NAME: z.string().trim().min(1).default('Demo Receptionist'),
  SEED_SECOND_STAFF_EMAIL: z
    .string()
    .email()
    .default('reception@cukurpro.local'),
  SEED_SECOND_STAFF_PASSWORD: z
    .string()
    .min(12)
    .default('ReceptionPassword123!'),
  SEED_PASSWORD_MODE: z.enum(['bcrypt', 'e2e']).default('bcrypt'),
});
type SeedConfig = z.infer<typeof seedEnvironmentSchema>;

async function upsertMember(
  tx: SeedTransaction,
  input: {
    organizationId: string;
    shopId: string;
    name: string;
    email: string;
    password: string;
    role: 'owner' | 'staff';
    passwordMode: 'bcrypt' | 'e2e';
  },
) {
  const passwordHash =
    input.passwordMode === 'e2e'
      ? `e2e:${input.password}`
      : await Bun.password.hash(input.password);
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
  if (!user) throw new Error(`Could not seed ${input.role} account.`);
  await tx
    .insert(organizationMemberships)
    .values({
      organizationId: input.organizationId,
      userId: user.id,
      role:
        input.role === 'owner' ? 'organization_owner' : 'organization_member',
    })
    .onConflictDoUpdate({
      target: [
        organizationMemberships.organizationId,
        organizationMemberships.userId,
      ],
      set: {
        role:
          input.role === 'owner' ? 'organization_owner' : 'organization_member',
        active: true,
        updatedAt: new Date(),
      },
    });
  await tx
    .insert(shopMemberships)
    .values({
      organizationId: input.organizationId,
      shopId: input.shopId,
      userId: user.id,
      role: input.role === 'owner' ? 'shop_manager' : 'receptionist',
    })
    .onConflictDoUpdate({
      target: [shopMemberships.shopId, shopMemberships.userId],
      set: {
        role: input.role === 'owner' ? 'shop_manager' : 'receptionist',
        active: true,
        updatedAt: new Date(),
      },
    });
  // Keep the legacy compatibility row while Phase 9 contraction is deferred.
  await tx.execute(sql`
    insert into staff_users (id, user_id, shop_id, email, name, password_hash, role, active)
    values (${user.id}, ${user.id}, ${input.shopId}, ${input.email.toLowerCase()}, ${input.name}, ${passwordHash}, ${input.role}, true)
    on conflict (id) do update set
      user_id = excluded.user_id,
      shop_id = excluded.shop_id,
      email = excluded.email,
      name = excluded.name,
      password_hash = excluded.password_hash,
      role = excluded.role,
      active = excluded.active,
      updated_at = now()
  `);
}

async function seed(config: SeedConfig): Promise<void> {
  const { client, database } = createDatabase(config.DATABASE_URL);
  try {
    await database.transaction(async (tx) => {
      const slug = 'cukurpro-demo-shop';
      let organization = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1)
        .then((r) => r[0]);
      if (!organization)
        [organization] = await tx
          .insert(organizations)
          .values({ name: config.SEED_SHOP_NAME, slug, lifecycle: 'active' })
          .returning();
      if (!organization)
        throw new Error('Could not seed the demo organization.');
      let shop = await tx
        .select()
        .from(shops)
        .where(
          and(eq(shops.organizationId, organization.id), eq(shops.slug, slug)),
        )
        .limit(1)
        .then((r) => r[0]);
      const values = {
        organizationId: organization.id,
        slug,
        name: config.SEED_SHOP_NAME,
        phone: config.SEED_SHOP_PHONE,
        email: config.SEED_SHOP_EMAIL.toLowerCase(),
        address: config.SEED_SHOP_ADDRESS,
        timezone: config.SEED_SHOP_TIMEZONE,
        updatedAt: new Date(),
      };
      if (shop)
        [shop] = await tx
          .update(shops)
          .set(values)
          .where(eq(shops.id, shop.id))
          .returning();
      else [shop] = await tx.insert(shops).values(values).returning();
      if (!shop) throw new Error('Could not seed the demo shop.');
      await upsertMember(tx, {
        organizationId: organization.id,
        shopId: shop.id,
        name: config.SEED_OWNER_NAME,
        email: config.SEED_OWNER_EMAIL,
        password: config.SEED_OWNER_PASSWORD,
        role: 'owner',
        passwordMode: config.SEED_PASSWORD_MODE,
      });
      await upsertMember(tx, {
        organizationId: organization.id,
        shopId: shop.id,
        name: config.SEED_STAFF_NAME,
        email: config.SEED_STAFF_EMAIL,
        password: config.SEED_STAFF_PASSWORD,
        role: 'staff',
        passwordMode: config.SEED_PASSWORD_MODE,
      });
      await upsertMember(tx, {
        organizationId: organization.id,
        shopId: shop.id,
        name: config.SEED_SECOND_STAFF_NAME,
        email: config.SEED_SECOND_STAFF_EMAIL,
        password: config.SEED_SECOND_STAFF_PASSWORD,
        role: 'staff',
        passwordMode: config.SEED_PASSWORD_MODE,
      });
    });
  } finally {
    await client.end();
  }
}

await seed(seedEnvironmentSchema.parse(process.env));
