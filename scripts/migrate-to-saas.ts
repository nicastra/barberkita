import { and, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import {
  boolean,
  text,
  timestamp,
  uuid,
  pgTable,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';

import { createDatabase, type Database } from '../server/src/db/client';
import {
  auditLogs,
  barberBreaks,
  barberProfiles,
  barberScheduleExceptions,
  barberServices,
  barberWorkingHours,
  bookingEvents,
  bookings,
  checkoutItems,
  checkoutPayments,
  checkouts,
  customers,
  organizationMemberships,
  organizations,
  paymentCorrections,
  sessions,
  shopMemberships,
  shops,
  systemMetadata,
  users,
} from '../server/src/db/schema';

// Kept local so this one-time migration remains runnable before the contraction
// migration removes the legacy table from the application schema.
const legacyStaffRole = pgEnum('staff_role', ['owner', 'staff']);
const legacyStaffUsers = pgTable('staff_users', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id'),
  shopId: uuid('shop_id').notNull(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: legacyStaffRole('role').notNull(),
  active: boolean('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

const environmentSchema = z.object({ DATABASE_URL: z.string().url() });
const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'provider',
  's',
  'sign-in',
  'www',
]);
type MigrationTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

const preservedTableNames = [
  'staff_users',
  'users',
  'sessions',
  'organizations',
  'organization_memberships',
  'shop_memberships',
  'shops',
  'services',
  'barber_profiles',
  'barber_services',
  'barber_working_hours',
  'barber_breaks',
  'barber_schedule_exceptions',
  'customers',
  'bookings',
  'booking_events',
  'checkouts',
  'checkout_items',
  'checkout_payments',
  'payment_corrections',
  'audit_logs',
  'tenant_audit_logs',
] as const;

async function tableCounts(
  transaction: MigrationTransaction,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of preservedTableNames) {
    const [row] = await transaction.execute<{ count: string }>(
      sql.raw(`select count(*)::text as count from "${table}"`),
    );
    counts[table] = Number(row?.count ?? 0);
  }
  return counts;
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'shop';
}

async function uniqueSlug(
  transaction: MigrationTransaction,
  base: string,
  kind: 'organization' | 'shop',
  id: string,
): Promise<string> {
  const rawCandidate = kind === 'shop' ? base : `${base}-org`;
  const candidate = RESERVED_SLUGS.has(rawCandidate)
    ? `${rawCandidate}-shop`
    : rawCandidate;
  const exists = async (slug: string) => {
    const rows =
      kind === 'shop'
        ? await transaction
            .select({ id: shops.id })
            .from(shops)
            .where(eq(shops.slug, slug))
            .limit(1)
        : await transaction
            .select({ id: organizations.id })
            .from(organizations)
            .where(eq(organizations.slug, slug))
            .limit(1);
    return rows.some((row) => row.id !== id);
  };
  if (!(await exists(candidate))) return candidate;
  let suffix = 1;
  while (
    await exists(
      `${candidate}-${id.slice(0, 8)}${suffix === 1 ? '' : `-${suffix}`}`,
    )
  )
    suffix += 1;
  return `${candidate}-${id.slice(0, 8)}${suffix === 1 ? '' : `-${suffix}`}`;
}

async function migrate(): Promise<void> {
  const parsed = environmentSchema.safeParse(process.env);
  if (!parsed.success) throw new Error('DATABASE_URL is required.');
  const { client, database } = createDatabase(parsed.data.DATABASE_URL);
  try {
    const [completed] = await database.execute<{ value: string }>(sql`
      select value from system_metadata where key = 'saas_migration_v1' limit 1
    `);
    if (completed?.value === 'complete') {
      console.log('SaaS migration already completed; no changes made.');
      return;
    }
    const [legacyState] = await database.execute<{ present: boolean }>(sql`
      select to_regclass('public.staff_users') is not null as present
    `);
    if (!legacyState?.present)
      throw new Error(
        'Unsupported schema state: additive SaaS migrations and staff_users are required before backfill.',
      );
    await database.transaction(async (transaction) => {
      const existingMarker = await transaction
        .select()
        .from(systemMetadata)
        .where(eq(systemMetadata.key, 'saas_migration_v1'))
        .limit(1)
        .then((rows) => rows[0]);
      if (existingMarker?.value === 'complete') return;
      const preCounts = await tableCounts(transaction);
      const [claim] = existingMarker
        ? [existingMarker]
        : await transaction
            .insert(systemMetadata)
            .values({ key: 'saas_migration_v1', value: 'started' })
            .returning();
      if (!claim) throw new Error('Could not claim SaaS migration.');

      const shop = await transaction
        .select()
        .from(shops)
        .orderBy(shops.createdAt)
        .limit(1)
        .then((rows) => rows[0]);
      if (!shop) throw new Error('Cannot migrate without an existing shop.');
      const shopCount = await transaction
        .select({ count: sql<number>`count(*)` })
        .from(shops)
        .then((rows) => Number(rows[0]?.count ?? 0));
      if (shopCount !== 1)
        throw new Error(
          'SaaS migration expects exactly one existing shop; review the installation before continuing.',
        );
      const [duplicateIdentity] = await transaction.execute<{ count: string }>(
        sql`select count(*)::text as count from (
          select lower(email) from staff_users group by lower(email) having count(*) > 1
        ) duplicates`,
      );
      if (Number(duplicateIdentity?.count ?? 0) > 0)
        throw new Error(
          'SaaS migration found duplicate staff email identities; reconcile them before continuing.',
        );

      let organization = shop.organizationId
        ? await transaction
            .select()
            .from(organizations)
            .where(eq(organizations.id, shop.organizationId))
            .limit(1)
            .then((rows) => rows[0])
        : undefined;
      if (!organization) {
        const organizationSlug = await uniqueSlug(
          transaction,
          slugify(shop.name),
          'organization',
          shop.id,
        );
        [organization] = await transaction
          .insert(organizations)
          .values({
            name: shop.name,
            slug: organizationSlug,
            lifecycle: 'active',
          })
          .returning();
      }
      if (!organization)
        throw new Error('Default organization creation failed.');

      const shopSlug =
        shop.slug ??
        (await uniqueSlug(transaction, slugify(shop.name), 'shop', shop.id));
      await transaction
        .update(shops)
        .set({
          organizationId: organization.id,
          slug: shopSlug,
          updatedAt: new Date(),
        })
        .where(eq(shops.id, shop.id));

      const staff = await transaction
        .select()
        .from(legacyStaffUsers)
        .orderBy(legacyStaffUsers.createdAt);
      const barbers = await transaction
        .select({ staffUserId: barberProfiles.staffUserId })
        .from(barberProfiles)
        .where(
          and(
            eq(barberProfiles.shopId, shop.id),
            isNotNull(barberProfiles.staffUserId),
          ),
        );
      const barberIds = new Set(
        barbers.flatMap((row) => (row.staffUserId ? [row.staffUserId] : [])),
      );
      const identityMappings: Array<{
        userId: string;
        role: 'organization_owner' | 'barber' | 'receptionist';
        barberLinked: boolean;
        mappingReason: 'owner' | 'linked_barber' | 'receptionist_fallback';
      }> = [];

      for (const member of staff) {
        await transaction
          .insert(users)
          .values({
            id: member.id,
            email: member.email,
            name: member.name,
            passwordHash: member.passwordHash,
            active: member.active,
          })
          .onConflictDoUpdate({
            target: users.id,
            set: {
              email: member.email,
              name: member.name,
              passwordHash: member.passwordHash,
              active: member.active,
              updatedAt: new Date(),
            },
          });
        await transaction
          .update(legacyStaffUsers)
          .set({ userId: member.id, updatedAt: new Date() })
          .where(eq(legacyStaffUsers.id, member.id));
        await transaction.execute(
          sql`UPDATE sessions SET user_id = ${member.id}, active_shop_id = ${shop.id} WHERE staff_user_id = ${member.id}`,
        );
        await transaction
          .insert(organizationMemberships)
          .values({
            organizationId: organization.id,
            userId: member.id,
            role:
              member.role === 'owner'
                ? 'organization_owner'
                : 'organization_member',
          })
          .onConflictDoUpdate({
            target: [
              organizationMemberships.organizationId,
              organizationMemberships.userId,
            ],
            set: {
              role:
                member.role === 'owner'
                  ? 'organization_owner'
                  : 'organization_member',
              active: member.active,
              updatedAt: new Date(),
            },
          });
        await transaction
          .insert(shopMemberships)
          .values({
            organizationId: organization.id,
            shopId: shop.id,
            userId: member.id,
            role:
              member.role === 'owner'
                ? 'shop_manager'
                : barberIds.has(member.id)
                  ? 'barber'
                  : 'receptionist',
            active: member.active,
          })
          .onConflictDoUpdate({
            target: [shopMemberships.shopId, shopMemberships.userId],
            set: {
              organizationId: organization.id,
              role:
                member.role === 'owner'
                  ? 'shop_manager'
                  : barberIds.has(member.id)
                    ? 'barber'
                    : 'receptionist',
              active: member.active,
              updatedAt: new Date(),
            },
          });
        identityMappings.push({
          userId: member.id,
          role:
            member.role === 'owner'
              ? 'organization_owner'
              : barberIds.has(member.id)
                ? 'barber'
                : 'receptionist',
          barberLinked: barberIds.has(member.id),
          mappingReason:
            member.role === 'owner'
              ? 'owner'
              : barberIds.has(member.id)
                ? 'linked_barber'
                : 'receptionist_fallback',
        });
      }

      for (const row of await transaction
        .select({ id: barberBreaks.id })
        .from(barberBreaks))
        await transaction
          .update(barberBreaks)
          .set({ shopId: shop.id })
          .where(eq(barberBreaks.id, row.id));
      for (const row of await transaction
        .select({ id: barberWorkingHours.id })
        .from(barberWorkingHours))
        await transaction
          .update(barberWorkingHours)
          .set({ shopId: shop.id })
          .where(eq(barberWorkingHours.id, row.id));
      for (const row of await transaction
        .select({ id: barberScheduleExceptions.id })
        .from(barberScheduleExceptions))
        await transaction
          .update(barberScheduleExceptions)
          .set({ shopId: shop.id })
          .where(eq(barberScheduleExceptions.id, row.id));
      for (const row of await transaction
        .select({
          barberId: barberServices.barberId,
          serviceId: barberServices.serviceId,
        })
        .from(barberServices))
        await transaction
          .update(barberServices)
          .set({ shopId: shop.id })
          .where(
            and(
              eq(barberServices.barberId, row.barberId),
              eq(barberServices.serviceId, row.serviceId),
            ),
          );
      for (const row of await transaction
        .select({ id: bookingEvents.id })
        .from(bookingEvents))
        await transaction
          .update(bookingEvents)
          .set({ shopId: shop.id })
          .where(eq(bookingEvents.id, row.id));
      for (const row of await transaction
        .select({ id: checkoutItems.id })
        .from(checkoutItems))
        await transaction
          .update(checkoutItems)
          .set({ shopId: shop.id })
          .where(eq(checkoutItems.id, row.id));
      for (const row of await transaction
        .select({ id: checkoutPayments.id })
        .from(checkoutPayments))
        await transaction
          .update(checkoutPayments)
          .set({ shopId: shop.id })
          .where(eq(checkoutPayments.id, row.id));
      for (const row of await transaction
        .select({ id: paymentCorrections.id })
        .from(paymentCorrections))
        await transaction
          .update(paymentCorrections)
          .set({ shopId: shop.id })
          .where(eq(paymentCorrections.id, row.id));
      await transaction
        .update(auditLogs)
        .set({ organizationId: organization.id, shopId: shop.id })
        .where(or(isNull(auditLogs.organizationId), isNull(auditLogs.shopId)));
      await transaction
        .insert(systemMetadata)
        .values({
          key: 'saas_migration_v1_pre_counts',
          value: JSON.stringify(preCounts),
        })
        .onConflictDoUpdate({
          target: systemMetadata.key,
          set: { value: JSON.stringify(preCounts) },
        });
      await transaction
        .insert(systemMetadata)
        .values({
          key: 'saas_migration_v1_identity_report',
          value: JSON.stringify({ mappings: identityMappings }),
        })
        .onConflictDoUpdate({
          target: systemMetadata.key,
          set: { value: JSON.stringify({ mappings: identityMappings }) },
        });
      await transaction
        .update(systemMetadata)
        .set({ value: 'complete' })
        .where(eq(systemMetadata.id, claim.id));
    });
    console.log('SaaS migration completed successfully.');
  } finally {
    await client.end();
  }
}

if (import.meta.main) await migrate();
