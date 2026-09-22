# Phase 8: Multi-Tenant Foundation

**Status: Completed**

[Previous: Phase 7](../phase-7-hardening-release.md) · [SaaS roadmap](README.md) · [Next: Phase 9](phase-9-migration-authentication.md)

## Activation decision

Phase 8 was the sole active phase by explicit product decision. Phase 7's manual
release gate is paused and must be resumed and completed before any production
MVP release. Phase 8 is complete and Phase 9 is now active.

## Objective

Establish tenant ownership, role boundaries, authorized request context, and
database isolation before adding any SaaS-facing feature.

## Dependencies

- The completed single-shop data model and operational workflows from Phases 0
  through 6, with Phase 7 hardening work paused.
- A reviewed inventory of every table, query, route, background operation, and
  public endpoint that currently assumes one global shop.

## TODO

### Tenant and identity model

- [x] Add `organizations` as paying customer businesses and attach each `shop` as a
      physical branch of exactly one organization.
- [x] Separate global login identities in `users` from authorization records in
      `organization_memberships` and `shop_memberships`.
- [x] Add `platform_admins` as an explicit provider-side registration; tenant roles
      never imply provider access.
- [x] Allow one user to belong to several organizations and branches without
      duplicate identities.
- [x] Add `tenant_audit_logs` containing organization, optional shop, actor, action,
      reason, timestamp, and request correlation metadata where available.
- [x] Represent organization roles (`organization_owner`, `organization_admin`,
      `organization_member`) and shop roles (`shop_manager`, `receptionist`,
      `barber`) with constrained values and documented permissions.

### Tenant-aware application boundary

- [x] Introduce middleware that authenticates the global user, verifies current
      memberships, organization state, and role, and creates an authorized tenant
      context for services.
- [x] Require organization administration under
      `/api/organizations/:organizationId/*`, branch operations under
      `/api/shops/:shopId/*`, public operations under
      `/api/public/shops/:shopSlug/*`, and provider operations under
      `/api/provider/*`.
- [x] Require every namespaced operational service call to receive the
      resolver-approved tenant context; legacy single-shop entry points remain
      available only through the documented compatibility layer.
- [x] Prepare protected frontend routes under `/app/:shopSlug/*`.
- [x] Make active branch selection explicit for users with several memberships.
- [x] Define stable authorization and tenant-state error codes so clients can
      distinguish missing membership, forbidden role, suspended organization, and
      unavailable public booking.

The boundary currently composes with the legacy session authenticator while the
new global-user tables are populated. Phase 9 performs the identity cutover;
tenant membership and branch authorization are already enforced by this layer.

### Database isolation

- [x] Add `organizationId` and complete `shopId` ownership paths for all scoped
      records, including historical, join, snapshot, audit, and idempotency data;
      organization ownership is derived through the staged shop relationship
      until Phase 9 makes denormalized columns required.
- [x] Add composite foreign keys and unique constraints where they can prevent a
      customer, service, barber, booking, checkout, payment, or related record from
      crossing shop boundaries.
- [x] Add justified indexes for tenant-prefixed filters and uniqueness rules.
- [x] Require organization or shop predicates in every tenant-scoped Drizzle query,
      including updates, deletes, reports, and identifier lookups. Legacy
      compatibility queries remain explicitly shop-scoped.
- [x] Add PostgreSQL Row-Level Security where practical as defense in depth. Set
      tenant values inside a transaction with transaction-local scope, and use a
      separate restricted pathway for provider operations.
- [x] Prove connection-pool reuse cannot retain organization, shop, user, role, or
      support-access context between requests.
- [x] Scope receipt-number and confirmation-code lookup by shop even when generated
      values remain globally collision-resistant.

### Migration compatibility

- [x] Design schema changes as an additive, staged expand-and-contract sequence so
      existing production records remain usable until Phase 9 completes backfill.
- [x] Define the compatibility behavior needed while new ownership columns are
      nullable and old single-shop authentication still exists.
- [x] Add staged shop ownership columns and composite relationship constraints
      for join, booking-event, checkout-item, payment, and audit records; legacy
      rows remain valid until the Phase 9 backfill.
- [x] Document the role mapping: current `owner` becomes organization owner and
      shop manager; current `staff` defaults to receptionist unless its identity is
      linked to a barber profile.

## Acceptance criteria

- The schema can represent several organizations, several branches per
  organization, and one user with memberships in more than one tenant.
- All protected operational routes derive and pass verified tenant context;
  changing an ID or slug does not grant access.
- Database constraints reject representative cross-shop booking, checkout, and
  membership relationships.
- Tenant-scoped reads and writes include explicit filters and pass adversarial
  cross-tenant integration tests.
- Provider authorization is independent from organization and shop roles.
- RLS and pooled-connection tests demonstrate that tenant context is local to
  one transaction and cannot leak to a later request.
- The additive migration design can coexist with current production data until
  Phase 9 performs the verified backfill and cutover.

## Exclusions

- Migrating production identities and records or removing legacy setup; these
  belong to Phase 9.
- Provider onboarding workflows, subscriptions, storefront redesign, and new
  reporting features.
- A separate database or schema per tenant.

[Previous: Phase 7](../phase-7-hardening-release.md) · [SaaS roadmap](README.md) · [Next: Phase 9](phase-9-migration-authentication.md)
