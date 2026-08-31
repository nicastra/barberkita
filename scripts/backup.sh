#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must identify the database to back up}"

backup_dir=${BACKUP_DIR:-./backups}
mkdir -p -- "$backup_dir"
backup_dir=$(cd -- "$backup_dir" && pwd -P)
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_name="cukurpro-${timestamp}.dump"
backup_path="${backup_dir}/${backup_name}"
umask 077

pg_dump --format=custom --no-owner --no-privileges --file="$backup_path" "$DATABASE_URL"
sha256sum "$backup_path" > "${backup_path}.sha256"
printf 'Backup written to %s\n' "$backup_path"
