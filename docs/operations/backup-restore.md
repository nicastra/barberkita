# PostgreSQL Backup and Restore

The deployment operator owns backup scheduling, encrypted off-host storage,
retention, monitoring, and restore drills. The repository supplies versioned
commands; it contains no credentials or backup data.

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
