-- Drizzle applies the journal in one pass, while the Phase 9 data backfill
-- must run before the legacy authentication table is contracted. The explicit
-- db:contract-saas command performs this guarded operation after reconciliation.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM system_metadata
    WHERE key = 'saas_migration_v1' AND value = 'complete'
  ) THEN
    RAISE NOTICE 'Skipping staff_users contraction until SaaS reconciliation is complete';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM sessions WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot remove staff_users: sessions.user_id contains NULL values';
  END IF;
  IF EXISTS (
    SELECT 1 FROM bookings b LEFT JOIN users u ON u.id = b.created_by_staff_user_id
    WHERE b.created_by_staff_user_id IS NOT NULL AND u.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM checkouts c LEFT JOIN users u ON u.id = c.created_by_staff_user_id
    WHERE c.created_by_staff_user_id IS NOT NULL AND u.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot remove staff_users: actor references are not present in users';
  END IF;

  ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_staff_user_id_staff_users_id_fk;
  ALTER TABLE barber_profiles DROP CONSTRAINT IF EXISTS barber_profiles_staff_user_id_staff_users_id_fk;
  ALTER TABLE booking_events DROP CONSTRAINT IF EXISTS booking_events_actor_staff_user_id_staff_users_id_fk;
  ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_created_by_staff_user_id_staff_users_id_fk;
  ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_shop_created_by_staff_fk;
  ALTER TABLE checkout_payments DROP CONSTRAINT IF EXISTS checkout_payments_recorded_by_staff_user_id_staff_users_id_fk;
  ALTER TABLE checkouts DROP CONSTRAINT IF EXISTS checkouts_created_by_staff_user_id_staff_users_id_fk;
  ALTER TABLE checkouts DROP CONSTRAINT IF EXISTS checkouts_shop_created_by_staff_fk;
  ALTER TABLE payment_corrections DROP CONSTRAINT IF EXISTS payment_corrections_recorded_by_staff_user_id_staff_users_id_fk;
  ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_staff_user_id_staff_users_id_fk;
  ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_id_users_id_fk;
  DROP INDEX IF EXISTS sessions_staff_user_id_idx;
  ALTER TABLE staff_users DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS staff_users CASCADE;
  ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_actor_staff_user_id_users_id_fk
    FOREIGN KEY (actor_staff_user_id) REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE barber_profiles ADD CONSTRAINT barber_profiles_staff_user_id_users_id_fk
    FOREIGN KEY (staff_user_id) REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE booking_events ADD CONSTRAINT booking_events_actor_staff_user_id_users_id_fk
    FOREIGN KEY (actor_staff_user_id) REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE bookings ADD CONSTRAINT bookings_created_by_staff_user_id_users_id_fk
    FOREIGN KEY (created_by_staff_user_id) REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE checkout_payments ADD CONSTRAINT checkout_payments_recorded_by_staff_user_id_users_id_fk
    FOREIGN KEY (recorded_by_staff_user_id) REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE checkouts ADD CONSTRAINT checkouts_created_by_staff_user_id_users_id_fk
    FOREIGN KEY (created_by_staff_user_id) REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE payment_corrections ADD CONSTRAINT payment_corrections_recorded_by_staff_user_id_users_id_fk
    FOREIGN KEY (recorded_by_staff_user_id) REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE sessions DROP COLUMN IF EXISTS staff_user_id;
  DROP TYPE IF EXISTS staff_role;
END $$;
