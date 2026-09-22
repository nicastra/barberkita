import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { createDatabase } from '../server/src/db/client';
import {
  auditLogs,
  bookings,
  checkoutPayments,
  checkouts,
  customers,
  organizationMemberships,
  shopMemberships,
  users,
} from '../server/src/db/schema';

const environmentSchema = z.object({ DATABASE_URL: z.string().url() });

type CountRow = { count: string };

type CountTable =
  | typeof users
  | typeof organizationMemberships
  | typeof shopMemberships
  | typeof bookings
  | typeof customers
  | typeof checkouts
  | typeof checkoutPayments
  | typeof auditLogs;

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
const countComparisonTables = preservedTableNames.filter(
  (table) =>
    ![
      // These are additive SaaS identity/scope tables. Their post-migration
      // counts are expected to differ from the empty pre-migration tables.
      'users',
      'organizations',
      'organization_memberships',
      'shop_memberships',
      'tenant_audit_logs',
    ].includes(table),
);

async function count(
  database: ReturnType<typeof createDatabase>['database'],
  table: CountTable,
) {
  const [row] = await database
    .select({ count: sql<number>`count(*)` })
    .from(table);
  return Number(row?.count ?? 0);
}

async function reconcile(): Promise<void> {
  const parsed = environmentSchema.safeParse(process.env);
  if (!parsed.success) throw new Error('DATABASE_URL is required.');
  const { client, database } = createDatabase(parsed.data.DATABASE_URL);
  try {
    const [orphanMemberships] = await database.execute<CountRow>(sql`
      select count(*)::text as count
      from shop_memberships sm
      left join shops s on s.id = sm.shop_id and s.organization_id = sm.organization_id
      where s.id is null
    `);
    const [orphanAudit] = await database.execute<CountRow>(sql`
      select count(*)::text as count from audit_logs
      where organization_id is null or shop_id is null
    `);
    const [orphanTenantAudit] = await database.execute<CountRow>(sql`
      select count(*)::text as count from tenant_audit_logs
      where organization_id is null or shop_id is null
    `);
    const [crossTenantBookings] = await database.execute<CountRow>(sql`
      select count(*)::text as count from bookings b
      left join customers c on c.id = b.customer_id and c.shop_id = b.shop_id
      left join services s on s.id = b.service_id and s.shop_id = b.shop_id
      left join barber_profiles bp on bp.id = b.barber_id and bp.shop_id = b.shop_id
      where c.id is null or s.id is null or bp.id is null
    `);
    const [crossTenantHistory] = await database.execute<CountRow>(sql`
      select count(*)::text as count from (
        select be.id from booking_events be
        left join bookings b on b.id = be.booking_id and b.shop_id = be.shop_id
        where b.id is null
        union all
        select ci.id from checkout_items ci
        left join checkouts c on c.id = ci.checkout_id and c.shop_id = ci.shop_id
        where c.id is null
        union all
        select cp.id from checkout_payments cp
        left join checkouts c on c.id = cp.checkout_id and c.shop_id = cp.shop_id
        where c.id is null
        union all
        select pc.id from payment_corrections pc
        left join checkout_payments cp on cp.id = pc.payment_id and cp.shop_id = pc.shop_id
        where cp.id is null
        union all
        select bs.barber_id from barber_services bs
        left join barber_profiles bp on bp.id = bs.barber_id and bp.shop_id = bs.shop_id
        left join services s on s.id = bs.service_id and s.shop_id = bs.shop_id
        where bp.id is null or s.id is null
      ) invalid
    `);
    const [orphanSchedules] = await database.execute<CountRow>(sql`
      select count(*)::text as count from (
        select bwh.id from barber_working_hours bwh
        left join barber_profiles bp on bp.id = bwh.barber_id and bp.shop_id = bwh.shop_id
        where bp.id is null
        union all
        select bb.id from barber_breaks bb
        left join barber_profiles bp on bp.id = bb.barber_id and bp.shop_id = bb.shop_id
        where bp.id is null
        union all
        select bse.id from barber_schedule_exceptions bse
        left join barber_profiles bp on bp.id = bse.barber_id and bp.shop_id = bse.shop_id
        where bp.id is null
      ) invalid
    `);
    const [duplicateUsers] = await database.execute<CountRow>(sql`
      select count(*)::text as count from (
        select lower(email) from users group by lower(email) having count(*) > 1
      ) duplicates
    `);
    const tables: [string, CountTable][] = [
      ['users', users],
      ['organization_memberships', organizationMemberships],
      ['shop_memberships', shopMemberships],
      ['bookings', bookings],
      ['customers', customers],
      ['checkouts', checkouts],
      ['checkout_payments', checkoutPayments],
      ['audit_logs', auditLogs],
    ];
    const counts: Record<string, number> = {};
    for (const [name, table] of tables)
      counts[name] = await count(database, table);
    for (const table of preservedTableNames) {
      const [present] = await database.execute<{ present: boolean }>(
        sql`select to_regclass(${`public.${table}`}) is not null as present`,
      );
      if (!present?.present) {
        counts[table] = 0;
        continue;
      }
      const [row] = await database.execute<CountRow>(
        sql.raw(`select count(*)::text as count from "${table}"`),
      );
      counts[table] = Number(row?.count ?? 0);
    }
    const [preCountRow] = await database.execute<{ value: string }>(sql`
      select value from system_metadata where key = 'saas_migration_v1_pre_counts' limit 1
    `);
    const [identityReportRow] = await database.execute<{ value: string }>(sql`
      select value from system_metadata where key = 'saas_migration_v1_identity_report' limit 1
    `);
    let identityReport: unknown = null;
    if (identityReportRow?.value) {
      try {
        identityReport = JSON.parse(identityReportRow.value) as unknown;
      } catch {
        identityReport = null;
      }
    }
    let recordedPreCounts: Record<string, number> | null = null;
    if (preCountRow?.value) {
      try {
        const parsed: unknown = JSON.parse(preCountRow.value);
        if (typeof parsed === 'object' && parsed !== null)
          recordedPreCounts = Object.fromEntries(
            Object.entries(parsed).filter(
              ([, value]) => typeof value === 'number',
            ),
          );
      } catch {
        recordedPreCounts = null;
      }
    }
    const countDifferences = recordedPreCounts
      ? Object.fromEntries(
          Object.entries(recordedPreCounts)
            .filter(
              ([table, value]) =>
                countComparisonTables.includes(
                  table as (typeof countComparisonTables)[number],
                ) &&
                counts[table] !== value &&
                !(table === 'staff_users' && counts[table] === 0),
            )
            .map(([table, value]) => [
              table,
              { before: value, after: counts[table] },
            ]),
        )
      : { _report: 'Missing recorded pre-migration counts.' };
    const [nullSessions] = await database.execute<CountRow>(
      sql`select count(*)::text as count from sessions where user_id is null`,
    );
    const [orphanActors] = await database.execute<CountRow>(
      sql`select count(*)::text as count from audit_logs a left join users u on u.id = a.actor_staff_user_id where a.actor_staff_user_id is not null and u.id is null`,
    );
    const report = {
      counts,
      orphanedShopMemberships: Number(orphanMemberships?.count ?? 0),
      unscopedAuditLogs: Number(orphanAudit?.count ?? 0),
      unscopedTenantAuditLogs: Number(orphanTenantAudit?.count ?? 0),
      crossTenantBookings: Number(crossTenantBookings?.count ?? 0),
      duplicateUserEmails: Number(duplicateUsers?.count ?? 0),
      nullSessionUsers: Number(nullSessions?.count ?? 0),
      orphanedActorUsers: Number(orphanActors?.count ?? 0),
      crossTenantHistoricalRecords: Number(crossTenantHistory?.count ?? 0),
      orphanedSchedules: Number(orphanSchedules?.count ?? 0),
      recordedPreCounts,
      countDifferences,
      identityReport,
    };
    console.log(JSON.stringify(report, null, 2));
    if (
      report.orphanedShopMemberships ||
      report.unscopedAuditLogs ||
      report.unscopedTenantAuditLogs ||
      report.crossTenantBookings ||
      report.duplicateUserEmails ||
      report.nullSessionUsers ||
      report.orphanedActorUsers ||
      report.crossTenantHistoricalRecords ||
      report.orphanedSchedules ||
      Object.keys(report.countDifferences).length
    )
      process.exitCode = 1;
  } finally {
    await client.end();
  }
}

if (import.meta.main) await reconcile();
