import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { createDatabase, type Database } from './client';
import { shops, staffUsers } from './schema';

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
});

type SeedConfig = z.infer<typeof seedEnvironmentSchema>;

async function upsertStaff(
  database: SeedTransaction,
  input: {
    shopId: string;
    name: string;
    email: string;
    password: string;
    role: 'owner' | 'staff';
  },
) {
  const passwordHash = await Bun.password.hash(input.password);
  const [account] = await database
    .insert(staffUsers)
    .values({
      shopId: input.shopId,
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      role: input.role,
      active: true,
    })
    .onConflictDoUpdate({
      target: staffUsers.email,
      set: {
        shopId: input.shopId,
        name: input.name,
        passwordHash,
        role: input.role,
        active: true,
        updatedAt: new Date(),
      },
    })
    .returning({ id: staffUsers.id });
  if (!account) throw new Error(`Could not seed ${input.role} account.`);
}

async function seed(config: SeedConfig): Promise<void> {
  const { client, database } = createDatabase(config.DATABASE_URL);
  try {
    await database.transaction(async (transaction) => {
      const existingOwner = await transaction
        .select({ shopId: staffUsers.shopId })
        .from(staffUsers)
        .where(eq(staffUsers.email, config.SEED_OWNER_EMAIL.toLowerCase()))
        .limit(1)
        .then((rows) => rows[0]);

      let shopId = existingOwner?.shopId;
      if (!shopId) {
        const existingShop = await transaction
          .select({ id: shops.id })
          .from(shops)
          .where(
            and(
              eq(shops.name, config.SEED_SHOP_NAME),
              eq(shops.email, config.SEED_SHOP_EMAIL.toLowerCase()),
            ),
          )
          .limit(1)
          .then((rows) => rows[0]);
        shopId = existingShop?.id;
      }

      if (!shopId) {
        const [shop] = await transaction
          .insert(shops)
          .values({
            name: config.SEED_SHOP_NAME,
            phone: config.SEED_SHOP_PHONE,
            email: config.SEED_SHOP_EMAIL.toLowerCase(),
            address: config.SEED_SHOP_ADDRESS,
            timezone: config.SEED_SHOP_TIMEZONE,
          })
          .returning({ id: shops.id });
        if (!shop) throw new Error('Could not seed the demo shop.');
        shopId = shop.id;
      } else {
        await transaction
          .update(shops)
          .set({
            name: config.SEED_SHOP_NAME,
            phone: config.SEED_SHOP_PHONE,
            email: config.SEED_SHOP_EMAIL.toLowerCase(),
            address: config.SEED_SHOP_ADDRESS,
            timezone: config.SEED_SHOP_TIMEZONE,
            updatedAt: new Date(),
          })
          .where(eq(shops.id, shopId));
      }

      await upsertStaff(transaction, {
        shopId,
        name: config.SEED_OWNER_NAME,
        email: config.SEED_OWNER_EMAIL,
        password: config.SEED_OWNER_PASSWORD,
        role: 'owner',
      });
      await upsertStaff(transaction, {
        shopId,
        name: config.SEED_STAFF_NAME,
        email: config.SEED_STAFF_EMAIL,
        password: config.SEED_STAFF_PASSWORD,
        role: 'staff',
      });
      await upsertStaff(transaction, {
        shopId,
        name: config.SEED_SECOND_STAFF_NAME,
        email: config.SEED_SECOND_STAFF_EMAIL,
        password: config.SEED_SECOND_STAFF_PASSWORD,
        role: 'staff',
      });
    });
    console.log(
      `Seeded demo shop with owner ${config.SEED_OWNER_EMAIL}, staff ${config.SEED_STAFF_EMAIL}, and staff ${config.SEED_SECOND_STAFF_EMAIL}.`,
    );
  } finally {
    await client.end();
  }
}

const parsed = seedEnvironmentSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid seed environment configuration.');
  process.exit(1);
}

await seed(parsed.data);
