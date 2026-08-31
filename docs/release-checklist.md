# Release Checklist

Record evidence in the team's release system; never commit credentials,
customer data, database dumps, or private deployment URLs.

## Build and review

- [ ] Review the diff and migrations; exclude secrets, dumps, and build output.
- [ ] Run `bun install --frozen-lockfile` in a clean checkout.
- [ ] Run `bun run check:release`.
- [ ] Review dependency advisories and resolve reachable high-impact findings.
- [ ] Complete security and accessibility review without release blockers.

## Data and deployment

- [ ] Create a fresh production backup and verify its checksum.
- [ ] Restore it into isolation and verify representative core records.
- [ ] Rehearse pending migrations against the isolated restore.
- [ ] Validate Compose, build immutable images, and deploy through migrations.
- [ ] Confirm database, API, and client health plus safe structured logs.
- [ ] Confirm Caddy serves a currently valid certificate for the app hostname.
- [ ] Record the pre-deployment backup path and verify its SHA-256 checksum.

## Acceptance journey

- [ ] Confirm initial setup is available only for a new installation.
- [ ] Sign in as owner and manage shop, staff, services, barber eligibility,
      hours, breaks, and an exception.
- [ ] Create staff and public bookings, including an unavailable-slot failure.
- [ ] Exercise check-in, queue, service, completion, cancellation/no-show, and
      walk-in behavior.
- [ ] Create checkout, retry an idempotent payment, apply an owner correction,
      and verify receipt history.
- [ ] Reconcile dashboard counts, corrected revenue, and performance reports.
- [ ] Repeat core screens with keyboard navigation at mobile, tablet, and
      desktop viewport sizes.

## Release decision

- [ ] Record image digest, migrations, backup ID, evidence, approver, and
      rollback contact.
- [ ] Re-run the deployed SHA and confirm deployment remains idempotent.
- [ ] Confirm the previous full-SHA image can be pulled for application
      rollback; treat database restoration as a separate downtime operation.
- [ ] Confirm monitoring and backup ownership before announcing completion.
