# PostgreSQL Backup and Restore

The deployment operator owns backup scheduling, encrypted off-host storage,
retention, monitoring, and restore drills. The repository supplies versioned
commands; it contains no credentials or backup data.

## Production pre-deployment policy

`scripts/deploy.sh` creates a PostgreSQL 17 custom-format dump immediately
before every deployment, including an empty pre-migration dump on first
installation. It writes the dump and SHA-256 checksum to
`/var/lib/cukurpro/backups` with mode `0600`. Image pulling and application
replacement stop if that backup fails. Keep enough verified pre-deployment
backups to cover the team's application rollback window; 30 days is a sensible
minimum for this MVP, subject to available disk and business policy.

List and verify backups without modifying them:

```sh
sudo -u deploy find /var/lib/cukurpro/backups -maxdepth 1 -type f -name '*.dump' -printf '%TY-%Tm-%Td %TH:%TM %s %p\n' | sort
cd /var/lib/cukurpro/backups
sha256sum -c cukurpro-TIMESTAMP-pre-COMMIT_SHA.dump.sha256
```

Pre-deployment-only backups do **not** protect against VPS or storage-volume
loss, and they leave long gaps when releases are infrequent. Add daily
encrypted off-site backups to private S3-compatible storage, with lifecycle
retention, checksum monitoring, narrowly scoped credentials, and periodic
restore drills. Do not regard upload success as proof of restorability.

## Automated backup

Install PostgreSQL 17 client tools and run with credentials from a secret
manager:

```sh
DATABASE_URL='postgres://...' BACKUP_DIR=/srv/cukurpro-backups ./scripts/backup.sh
```

The script creates a custom-format dump with restrictive permissions and a
SHA-256 checksum. Schedule it using the platform scheduler. A representative
daily cron entry is:

```cron
15 18 * * * DATABASE_URL='from-secret-wrapper' BACKUP_DIR=/srv/cukurpro-backups /opt/cukurpro/scripts/backup.sh
```

Do not put a literal production password in crontab. Copy completed dumps to
encrypted off-host storage and alert when no recent valid checksum exists.

## Isolated restore drill

Never point the restore command at production. Create an empty isolated
database, then run:

```sh
RESTORE_DATABASE_URL='postgres://.../cukurpro_restore' \
RESTORE_CONFIRMATION=restore-isolated-database \
./scripts/restore.sh /srv/cukurpro-backups/cukurpro-TIMESTAMP.dump
```

The script verifies the checksum when present, restores with error-on-failure,
and queries core record counts. Run application checks against the isolated URL
and verify representative customers, appointments, receipts, corrections, and
reports. Record the drill date, backup ID, operator, recovery duration, and
result in the operations system, then destroy the isolated database using the
platform's approved process.

On the VPS, use a temporary PostgreSQL 17 container and a private Docker
network so the drill database is never published:

```sh
docker network create cukurpro-restore
docker run -d --name cukurpro-restore-db --network cukurpro-restore \
  -e POSTGRES_DB=cukurpro_restore \
  -e POSTGRES_USER=cukurpro_restore \
  -e POSTGRES_PASSWORD=REPLACE_WITH_TEMPORARY_PASSWORD \
  postgres:17-alpine
until docker exec cukurpro-restore-db pg_isready -U cukurpro_restore -d cukurpro_restore; do sleep 2; done
docker run --rm --network cukurpro-restore \
  -e RESTORE_DATABASE_URL=postgres://cukurpro_restore:REPLACE_WITH_TEMPORARY_PASSWORD@cukurpro-restore-db:5432/cukurpro_restore \
  -e RESTORE_CONFIRMATION=restore-isolated-database \
  -v /opt/cukurpro:/workspace:ro \
  -v /var/lib/cukurpro/backups:/backups:ro \
  -w /workspace postgres:17-alpine \
  sh scripts/restore.sh /backups/cukurpro-TIMESTAMP-pre-COMMIT_SHA.dump
docker stop cukurpro-restore-db
docker rm cukurpro-restore-db
docker network rm cukurpro-restore
```

The last three commands remove only the named isolated drill resources. Never
set `RESTORE_DATABASE_URL` to the production `postgres` service. A production
restore requires a reviewed downtime plan, explicit approval, confirmation of
the target backup and checksum, and a decision about data created since it.
