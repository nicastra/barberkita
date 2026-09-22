import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { createDatabase } from '../server/src/db/client';

const environmentSchema = z.object({ DATABASE_URL: z.string().url() });

/** Contract the legacy authentication table only after the backfill report is clean. */
export async function contractSaas(): Promise<void> {
  const parsed = environmentSchema.safeParse(process.env);
  if (!parsed.success) throw new Error('DATABASE_URL is required.');
  const { client, database } = createDatabase(parsed.data.DATABASE_URL);
  try {
    await database.transaction(async (transaction) => {
      const marker = await transaction.execute<{ value: string }>(sql`
        select value from system_metadata where key = 'saas_migration_v1' limit 1
      `);
      if (marker[0]?.value !== 'complete')
        throw new Error(
          'SaaS contraction requires a completed migration and reconciliation.',
        );
      const staffTable = await transaction.execute<{ present: boolean }>(sql`
        select to_regclass('public.staff_users') is not null as present
      `);
      if (!staffTable[0]?.present) return;
      const nullSessions = await transaction.execute<{ count: string }>(sql`
        select count(*)::text as count from sessions where user_id is null
      `);
      if (Number(nullSessions[0]?.count ?? 0) > 0)
        throw new Error(
          'Cannot contract SaaS authentication with orphan sessions.',
        );
      const orphanActors = await transaction.execute<{ count: string }>(sql`
        select count(*)::text as count
        from bookings b left join users u on u.id = b.created_by_staff_user_id
        where b.created_by_staff_user_id is not null and u.id is null
      `);
      if (Number(orphanActors[0]?.count ?? 0) > 0)
        throw new Error(
          'Cannot contract SaaS authentication with orphan actors.',
        );

      const statements = [
        sql`alter table audit_logs drop constraint if exists audit_logs_actor_staff_user_id_staff_users_id_fk`,
        sql`alter table barber_profiles drop constraint if exists barber_profiles_staff_user_id_staff_users_id_fk`,
        sql`alter table booking_events drop constraint if exists booking_events_actor_staff_user_id_staff_users_id_fk`,
        sql`alter table bookings drop constraint if exists bookings_created_by_staff_user_id_staff_users_id_fk`,
        sql`alter table bookings drop constraint if exists bookings_shop_created_by_staff_fk`,
        sql`alter table checkout_payments drop constraint if exists checkout_payments_recorded_by_staff_user_id_staff_users_id_fk`,
        sql`alter table checkouts drop constraint if exists checkouts_created_by_staff_user_id_staff_users_id_fk`,
        sql`alter table checkouts drop constraint if exists checkouts_shop_created_by_staff_fk`,
        sql`alter table payment_corrections drop constraint if exists payment_corrections_recorded_by_staff_user_id_staff_users_id_fk`,
        sql`alter table sessions drop constraint if exists sessions_staff_user_id_staff_users_id_fk`,
        sql`alter table sessions drop constraint if exists sessions_user_id_users_id_fk`,
        sql`drop index if exists sessions_staff_user_id_idx`,
        sql`alter table staff_users disable row level security`,
        sql`drop table staff_users cascade`,
        sql`alter table audit_logs add constraint audit_logs_actor_staff_user_id_users_id_fk foreign key (actor_staff_user_id) references users(id) on delete set null`,
        sql`alter table barber_profiles add constraint barber_profiles_staff_user_id_users_id_fk foreign key (staff_user_id) references users(id) on delete set null`,
        sql`alter table booking_events add constraint booking_events_actor_staff_user_id_users_id_fk foreign key (actor_staff_user_id) references users(id) on delete set null`,
        sql`alter table bookings add constraint bookings_created_by_staff_user_id_users_id_fk foreign key (created_by_staff_user_id) references users(id) on delete set null`,
        sql`alter table checkout_payments add constraint checkout_payments_recorded_by_staff_user_id_users_id_fk foreign key (recorded_by_staff_user_id) references users(id) on delete set null`,
        sql`alter table checkouts add constraint checkouts_created_by_staff_user_id_users_id_fk foreign key (created_by_staff_user_id) references users(id) on delete set null`,
        sql`alter table payment_corrections add constraint payment_corrections_recorded_by_staff_user_id_users_id_fk foreign key (recorded_by_staff_user_id) references users(id) on delete set null`,
        sql`alter table sessions add constraint sessions_user_id_users_id_fk foreign key (user_id) references users(id) on delete cascade`,
        sql`alter table sessions drop column if exists staff_user_id`,
        sql`drop type if exists staff_role`,
      ];
      for (const statement of statements) await transaction.execute(statement);
    });
    console.log(
      'SaaS legacy authentication contraction completed successfully.',
    );
  } finally {
    await client.end();
  }
}

if (import.meta.main) await contractSaas();
