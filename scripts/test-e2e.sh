#!/usr/bin/env bash
set -euo pipefail

project_name=cukurpro-e2e
postgres_port=${E2E_POSTGRES_PORT:-55432}
database_url="postgres://cukurpro_e2e:cukurpro_e2e@127.0.0.1:${postgres_port}/cukurpro_e2e"
backup_test_dir=$(mktemp -d "${TMPDIR:-/tmp}/cukurpro-e2e-backup.XXXXXX")

cleanup() {
  docker compose -p "$project_name" -f compose.e2e.yaml down --volumes --remove-orphans
  case "$backup_test_dir" in
    "${TMPDIR:-/tmp}"/cukurpro-e2e-backup.*) rm -rf -- "$backup_test_dir" ;;
  esac
}
trap cleanup EXIT

docker compose -p "$project_name" -f compose.e2e.yaml up --detach --wait
DATABASE_URL="$database_url" bun run db:migrate
TEST_DATABASE_URL="$database_url" bunx vitest run --config e2e/vitest.config.ts

docker compose -p "$project_name" -f compose.e2e.yaml exec -T database createdb -U cukurpro_e2e cukurpro_restore
docker run --rm --network host \
  -e DATABASE_URL="$database_url" \
  -e BACKUP_DIR=/backups \
  -v "$PWD:/workspace:ro" \
  -v "$backup_test_dir:/backups" \
  -w /workspace \
  postgres:17-alpine sh scripts/backup.sh
backup_path=$(find "$backup_test_dir" -maxdepth 1 -type f -name '*.dump' -print -quit)
if [ -z "$backup_path" ]; then
  printf 'Backup verification did not produce a dump.\n' >&2
  exit 1
fi
docker run --rm --network host \
  -e RESTORE_DATABASE_URL="postgres://cukurpro_e2e:cukurpro_e2e@127.0.0.1:${postgres_port}/cukurpro_restore" \
  -e RESTORE_CONFIRMATION=restore-isolated-database \
  -v "$PWD:/workspace:ro" \
  -v "$backup_test_dir:/backups:ro" \
  -w /workspace \
  postgres:17-alpine sh scripts/restore.sh "/backups/$(basename "$backup_path")"
