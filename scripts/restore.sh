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
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c "select count(*) as shops from shops; select count(*) as staff_users from staff_users; select count(*) as bookings from bookings; select count(*) as checkouts from checkouts;"
printf 'Restore and core-record verification completed.\n'
