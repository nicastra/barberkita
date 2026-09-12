# Phase 9: Migration and SaaS Authentication

**Status: Completed**

[Previous: Phase 8](phase-8-multi-tenant-foundation.md) · [SaaS roadmap](README.md) · [Next: Phase 10](phase-10-provider-onboarding.md)

## Objective

Migrate the released single-shop installation into the tenant model without
losing identity or operational history, then replace global setup assumptions
with membership-aware authentication, onboarding, and invitations.

## Dependencies

- Phase 8 provides the additive tenant schema, authorized request context, role
  model, and isolation controls.
- A verified production backup and an isolated environment for migration
  rehearsal and reconciliation.

## Deliverables

### Existing-data migration

- [x] Create one default organization for the current business and attach the
      existing shop without changing its shop ID.
- [x] Generate a unique, reviewed slug for the existing shop and define a collision
      and reserved-name policy.
- [x] Convert current staff identities to global users plus organization and shop
      memberships while preserving user IDs, password hashes, and sessions where
      compatibility and security review allow.
- [x] Map every current `owner` to organization owner and shop manager. Map current
      `staff` to barber when it is linked unambiguously to a barber profile;
      otherwise default it to receptionist and produce a review report.
- [x] Backfill organization and shop ownership through all operational and
      historical tables before making required ownership columns non-null.
- [x] Preserve bookings, customers, schedules, exceptions, checkouts, payments,
      refunds, idempotency records, audit history, and timestamps.
- [x] Use staged, restartable migrations with explicit preconditions. Take and
      verify a backup before applying them and rehearse both application rollback
      and database restoration decisions.
- [x] Supply reconciliation queries for per-table counts, orphaned records,
      duplicate identities, membership mappings, and cross-tenant relationships.
- [x] Remove compatibility columns or legacy constraints only after backfill,
      application cutover, and reconciliation pass.

### SaaS authentication and authorization

- [x] Keep one secure global session per signed-in user and resolve current
      organization and shop permissions on every protected request.
- [x] Add explicit branch switching without another sign-in and validate the chosen
      branch against current membership each time.
- [x] Replace global `initial_owner_setup` with provider-approved organization
      onboarding and membership invitations only after migrated ownership is
      verified.
- [x] Add invitations with cryptographically strong tokens, expiration, one-time
      use, hashed-at-rest token storage, revocation, intended role and scope, and
      race-safe acceptance.
- [x] Ensure role changes, suspension, membership removal, and invitation revocation
      invalidate effective access immediately rather than waiting for session
      expiry.
- [x] Require recent reauthentication for ownership transfer and other sensitive
      account or provider actions.
- [x] Record sign-in success and failure, invitation lifecycle, membership changes,
      branch switches, role changes, ownership transfer, and support-access events
      without recording secrets.

### Prior cutover evidence

The local PostgreSQL rehearsal has applied the complete additive migration set
through `0014_cultured_the_spike.sql`, completed `db:migrate-saas`, rerun it
idempotently, and passed `db:reconcile-saas` with zero orphaned memberships,
unscoped audit records, cross-tenant bookings, or duplicate user emails. Legacy
compatibility fields remain intentionally because the compatibility routes still
read and write `staff_users`; their removal requires the post-cutover contract
change. Provider-approved organization creation belongs to Phase 10, and the
recent reauthentication is now enforced for invitation and membership changes
through `POST /api/auth/reauthenticate`, with a 15-minute session window and
audit events for success and failure. Legacy compatibility cleanup and
provider-approved onboarding remain explicit follow-up gates because the
current operational routes still depend on `staff_users` and the provider
console is the next roadmap phase.

This evidence is retained as implementation history. The follow-up cutover
verification now closes the remaining authorization and acceptance gates:
unscoped routes are opt-in compatibility surfaces, all frontend operational
requests carry an explicit branch scope, and the Docker-backed suite covers
tenant tampering, suspension, session invalidation, and audit behavior.

## Reopening TODO

### Migration and reconciliation

- [x] Define and automate an executable upgrade sequence that applies additive
      migrations, runs `db:migrate-saas`, reconciles the migrated data, and only
      then applies the compatibility-table contraction migration.
- [x] Make the migration command fail safely with clear preconditions when run
      against an unsupported schema state, and prove a completed migration can
      be rerun without changing data.
- [x] Expand reconciliation to compare recorded pre- and post-migration counts
      for every preserved operational and historical table, including schedules,
      exceptions, booking events, checkout items, payments, corrections,
      idempotency records, and audit history.
- [x] Produce a reviewable identity and role-mapping report, including ambiguous
      staff-to-barber mappings and receptionist fallbacks, without exposing
      password hashes, session tokens, or invitation tokens.
- [x] Rehearse the complete upgrade against a representative single-shop backup,
      including application rollback, isolated database restoration, final
      contraction, and reconciliation with no unexplained differences or
      cross-tenant relationships.

### Authentication and tenant authorization

- [x] Pass an authorized organization context to invitation administration and
      prove organization owners and administrators can create, list, and revoke
      invitations only within their organization and permitted role boundary.
- [x] Add real-database coverage for invitation expiration, revocation, reuse,
      concurrent acceptance, hashed-at-rest tokens, intended scope, and safe
      indistinguishable failures.
- [x] Complete the cutover from legacy unscoped operational and public routes to
      the tenant-scoped namespaces, and update the centralized frontend API layer
      to use the selected branch explicitly.
- [x] Prove suspension blocks every operational write and public booking path,
      including compatibility paths that remain temporarily available, while
      preserving authorized reads and exports.
- [x] Prove branch switching, role changes, membership removal, user
      deactivation, and invitation revocation affect the next authorization
      decision across active sessions.
- [x] Prove recent reauthentication and secret-free audit events cover every
      sensitive membership, ownership, invitation, branch-switch, sign-in, and
      provider action that belongs to this phase.

### Acceptance and documentation

- [x] Replace the obsolete clean-database setup E2E workflow with a
      representative migrated single-shop fixture and wire the tenant and
      invitation services into the real-database application under test.
- [x] Add multi-organization and multi-branch acceptance cases for identifier
      tampering, public slug isolation, cross-shop relationship rejection,
      active-branch selection, and pooled-connection tenant-context leakage.
- [x] Extend backup and restore acceptance to verify organizations,
      memberships, retained sessions, operational history, and tenant boundaries
      after restoration.
- [x] Update setup, production, migration, and API documentation to match the
      final cutover behavior and migration ordering.
- [x] Run formatting, strict type checking, unit and integration tests,
      production builds, the Docker-backed PostgreSQL acceptance suite,
      migration rehearsal, reconciliation, and restore drill before completing
      the phase again.

## Acceptance criteria

- A rehearsed migration preserves the ID and every operational record of the
  existing shop while placing all records in one reconciled organization.
- Password hashes and safe sessions continue to work as designed; any session
  intentionally invalidated is documented and forces a secure sign-in.
- Count and integrity reconciliation reports contain no unexplained difference,
  orphan, or cross-shop reference.
- The global setup endpoint is unavailable only after the default owner and
  memberships have been verified.
- A user can accept an invitation once, sign in once, and switch among only the
  branches to which it currently belongs.
- Expired, revoked, reused, or concurrently accepted invitation tokens fail
  safely and do not reveal token existence.
- Membership and role changes affect the next authorization decision, and
  sensitive changes require reauthentication and an audit record.
- Backup and restore tests preserve all organizations, memberships, sessions
  retained by policy, and tenant boundaries.

## Exclusions

- Self-service organization creation and unapproved public tenant signup.
- Social login, enterprise SSO, SCIM, and hardware security-key requirements.
- Provider lifecycle screens and plan enforcement, which follow in Phases 10
  and 11.

[Previous: Phase 8](phase-8-multi-tenant-foundation.md) · [SaaS roadmap](README.md) · [Next: Phase 10](phase-10-provider-onboarding.md)
