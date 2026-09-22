# SaaS migration rehearsal

`db:migrate-saas-upgrade` is the production sequencing command. It applies the
additive Drizzle journal, runs the Phase 9 single-shop backfill in one
transaction, reconciles the preserved data, and contracts the legacy
authentication table only after reconciliation succeeds. Each stage is
restartable: a completed run records the `saas_migration_v1` marker and later
runs make no changes.

Before running it in production:

1. Create and verify a PostgreSQL backup using the [backup and restore
   runbook](backup-restore.md).
2. Apply the additive migrations through `0012_funny_scalphunter.sql` and verify
   the application is healthy.
3. Rehearse in an isolated restore and record the pre-migration counts.

Run the migration from the repository root with a dedicated database URL:

```sh
DATABASE_URL='postgres://user:password@host:5432/cukurpro' bun run db:migrate-saas-upgrade
```

The transaction creates one active organization, assigns the existing shop a
unique slug, preserves each `staff_users.id` as the corresponding global user
ID, links sessions, creates organization/shop memberships, maps owners to
`organization_owner`/`shop_manager`, maps linked barbers to `barber`, and maps
the remaining staff to `receptionist`. Staged child ownership columns and
legacy audit rows are backfilled before the marker is set to `complete`.
It refuses to proceed when the installation has more than one shop, duplicate
case-insensitive staff email identities, missing legacy tables, or an
unsupported migration state.

Slugs are lowercase URL-safe names derived from the shop name. Collisions get
an ID suffix, and reserved application paths (`admin`, `api`, `app`, `provider`,
`s`, `sign-in`, and `www`) receive a `-shop` suffix.

The backfill records pre-migration counts and a secret-free identity/role
mapping report in `system_metadata`. Reconciliation compares preserved
operational and historical tables, including schedules, booking events,
checkout items, payments, corrections, audit actors, and cross-tenant
relationships. It emits a machine-readable report and exits non-zero when an
integrity problem is found:

```sh
DATABASE_URL='postgres://user:password@host:5432/cukurpro' bun run db:reconcile-saas
```

When stages are run separately, the final contraction is explicit and refuses
to run until the migration marker is complete:

```sh
DATABASE_URL='postgres://user:password@host:5432/cukurpro' bun run db:contract-saas
```

```sql
select count(*) from staff_users;
select count(*) from users;
select count(*) from organization_memberships;
select count(*) from shop_memberships;
select count(*) from bookings;
select count(*) from checkouts;
select count(*) from checkout_payments;
select count(*) from audit_logs where organization_id is null or shop_id is null;
select count(*) from shop_memberships sm
left join shops s on s.id = sm.shop_id and s.organization_id = sm.organization_id
where s.id is null;
```

If any count or relationship is unexpected, stop the cutover, restore the
verified backup in an isolated database, and investigate. The contraction
removes `staff_users` only after the migration and reconciliation preconditions
pass; a completed migration can still be rerun safely afterward.

Phase 10 adds migration `0016_rich_bloodstorm.sql`. It creates one current
subscription row for each provider-approved organization and write-once
onboarding milestone rows. Apply it with the normal `db:migrate` step before
enabling the owner checklist endpoint; no global setup marker is introduced.

Migration `0017_equal_lord_hawal.sql` adds support grants and append-only grant
events. A support grant is never represented as a tenant membership. Ordinary
requests remain pending until an organization owner approves them; break-glass
grants are provider-only and capped at 60 minutes. Each authorization rechecks
the provider identity, target organization, status, and expiry.

After cutover, organization administrators can create and revoke invitations
under `/api/organizations/:organizationId/invitations`. The response contains
the raw token once so it can be delivered through the approved invitation
channel; only its SHA-256 hash is stored. Invitees accept with
`POST /api/invitations/:token/accept`, after which the token is permanently
marked used and the resulting membership is active immediately. A signed-in
user switches branches with `POST /api/auth/switch-shop/:shopId`; the session's
active branch is revalidated on every protected request.

Operational and public compatibility routes are disabled by default
(`enableLegacyRoutes: false`). They may be enabled only for a controlled
migration rehearsal; production frontend calls use
`/api/shops/:shopId/*` and public `/api/public/shops/:shopSlug/*` paths. Branch
membership and role changes invalidate affected sessions immediately, and a
user whose active branch is removed is moved to another authorized branch (or
denied if none remain).

## Phase 10 lifecycle test fixture

Create an idempotent pilot organization, owner account, and standalone platform
administrator with the tenant seed command:

```sh
DATABASE_URL='postgres://user:password@host:5432/cukurpro' bun run db:seed-tenant
```

The command prints the seeded organization and shop IDs plus local test
credentials as JSON. Defaults are `pilot-owner@cukurpro.local` /
`PilotOwnerPassword123!` for the tenant owner and
`provider-admin@cukurpro.local` / `ProviderPassword123!` for the provider
administrator. Override `TENANT_SEED_*` variables for non-local environments;
never use these defaults in production.

The provider administrator can transition the seeded organization through the
provider API. Every transition requires recent reauthentication and a reason:

```sh
curl -X PATCH "$API_URL/api/provider/organizations/$ORGANIZATION_ID/lifecycle" \
  -H 'Content-Type: application/json' \
  -H "Cookie: $PROVIDER_SESSION_COOKIE" \
  -d '{"lifecycle":"suspended","reason":"Lifecycle test"}'
```

Allowed transitions are `trialing` → `active`, `suspended`, or `archived`;
`active` → `suspended` or `archived`; and `suspended` → `active` or `archived`.
`archived` is terminal. Suspended organizations retain authorized reads but
reject operational writes and public bookings; archived organizations are not
available to normal tenant operations.

The Docker-backed acceptance script rehearses this sequence against a seeded
single-shop fixture: additive migration, backfill, reconciliation, guarded
legacy contraction, idempotent rerun, and backup/isolated-restore verification.
