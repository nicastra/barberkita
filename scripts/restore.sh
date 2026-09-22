#!/bin/sh
set -eu

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL must identify an isolated restore database}"
: "${RESTORE_CONFIRMATION:?Set RESTORE_CONFIRMATION=restore-isolated-database}"

if [ "$RESTORE_CONFIRMATION" != "restore-isolated-database" ]; then
  printf 'Refusing restore: confirmation does not match.\n' >&2
  exit 2
fi
if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
  printf 'Usage: RESTORE_DATABASE_URL=... RESTORE_CONFIRMATION=restore-isolated-database %s BACKUP.dump\n' "$0" >&2
  exit 2
fi

backup_path=$(cd -- "$(dirname -- "$1")" && pwd -P)/$(basename -- "$1")
if [ -f "${backup_path}.sha256" ]; then
  (
    cd -- "$(dirname -- "$backup_path")"
    sha256sum -c "$(basename -- "$backup_path").sha256"
  )
fi

pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --dbname="$RESTORE_DATABASE_URL" "$backup_path"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c "select count(*) as organizations from organizations; select count(*) as shops from shops; select count(*) as users from users; select count(*) as organization_memberships from organization_memberships; select count(*) as shop_memberships from shop_memberships; select count(*) as sessions from sessions; select count(*) as bookings from bookings; select count(*) as checkouts from checkouts; select count(*) as cross_tenant_bookings from bookings b left join customers c on c.id = b.customer_id and c.shop_id = b.shop_id left join services s on s.id = b.service_id and s.shop_id = b.shop_id left join barber_profiles bp on bp.id = b.barber_id and bp.shop_id = b.shop_id where c.id is null or s.id is null or bp.id is null;"
printf 'Restore and core-record verification completed.\n'
