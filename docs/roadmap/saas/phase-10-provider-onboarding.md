# Phase 10: Provider Console and Pilot Onboarding

**Status: Completed**

[Previous: Phase 9](phase-9-migration-authentication.md) · [SaaS roadmap](README.md) · [Next: Phase 11](phase-11-plans-billing.md)

## Objective

Give designated CukurPro administrators a metadata-first provider console and a
controlled pilot-onboarding workflow while keeping tenant operations private by
default.

## Dependencies

- Phase 9 provides migrated global users, secure invitations, memberships,
  explicit provider identities, and complete authorization audit events.

## Phase 10 completion checklist

This checklist is the completion gate for Phase 10. Phase 11 work must not
start until every item below is checked and the PostgreSQL acceptance suite is
green.

### Provider console and authorization

- [x] Provider API and browser routes require an explicit `platform_admin`
      identity.
- [x] Provider organization creation, lifecycle, invitation, support, and
      onboarding actions are exposed through audited provider screens.
- [x] Default provider responses remain metadata-only: no customer names,
      bookings, payments, revenue, or barber-performance data.
- [x] Provider route denial is covered by both API and browser tests.

### Organization lifecycle and subscription state

- [x] Allowed lifecycle transitions and stable error codes are defined and
      tested.
- [x] Every lifecycle transition updates the current subscription record in
      the same transaction and preserves ordered audit history.
- [x] Trial expiry, suspension, reactivation, and archival behavior is
      explicitly documented and tested.
- [x] Suspended organizations are read-only for authorized reads/exports,
      reject operational writes, and disable public booking.
- [x] Archived organizations are unavailable for normal operations while
      retaining tenant data.

### Pilot onboarding and invitations

- [x] First-branch creation is provider-provisioned for the pilot; the owner
      invitation activates and configures the already-created branch.
- [x] Organization creation initializes lifecycle and subscription state
      atomically.
- [x] Owner invitation acceptance, activation, first-branch setup, and
      configuration milestones are persisted and audited.
- [x] Invitation delivery is a manual, one-time token handoff in the pilot;
      email delivery integration is deferred until a later phase.
- [x] The persisted tenant-scoped setup checklist reaches completion in an
      acceptance test.

### Audited support access

- [x] An active support grant is represented in request/session context without
      creating tenant membership.
- [x] Every supported request verifies provider identity, target organization,
      active grant, organization match, and expiry.
- [x] Support access sets the correct transaction-local tenant context on pooled
      connections.
- [x] Ordinary access requires owner approval; break-glass access is limited to
      designated providers, requires a reason, and has a short expiry.
- [x] Grant creation, approval, entry, operational action, revocation, and
      expiry append ordered audit events.
- [x] Revocation and expiry take effect immediately, including concurrent
      requests, and a grant can never become membership.
- [x] Support access is isolated to its target organization and cannot be
      reused across organizations.

### Acceptance and release gates

- [x] Real PostgreSQL tests cover provider denial, browser route denial,
      organization creation, invitation acceptance, checklist completion,
      lifecycle/subscription synchronization, and archived behavior.
- [x] Real PostgreSQL support tests cover approval, break-glass, scoping,
      expiry, revocation, concurrent authorization, operational access, and
      complete audit history.
- [x] Provider API responses are checked for absence of customer, booking,
      payment, revenue, and performance data.
- [x] Formatting, strict type checks, unit tests, production builds, Docker
      E2E, migration/reconciliation, and restore verification all pass.
- [x] This document is changed to **Completed** only after all gates pass.

## Deliverables

### Provider dashboard

- [x] Add a provider-only console separated from tenant navigation and guarded by
      explicit `platform_admin` registration.
- [x] Show organizations and branches, trial or subscription status, plan and
      entitlement metadata, active user and shop counts, lifecycle state, recent
      platform activity, and operational health.
- [x] Keep customer names, bookings, payments, revenue, and barber performance out
      of default provider APIs, logs, searches, and screens.
- [x] Make provider actions auditable with actor, target, reason where relevant,
      prior and resulting state, and timestamp.

### Tenant lifecycle

- [x] Model organization lifecycle as `trialing`, `active`, `suspended`, or
      `archived`, with explicit allowed transitions and stable errors.
- [x] Make suspended organizations read-only to authorized organization owners,
      reject operational writes, and disable public booking without deleting data.
- [x] Define archived organizations as unavailable for normal operations while
      retaining data according to policy; do not automatically hard-delete tenant
      records.
- [x] Ensure lifecycle checks live in shared server authorization and services, not
      only in the provider UI.

### Provider-approved onboarding

- [x] Let a provider administrator create or approve an organization, initialize a
      trial subscription record, and send the first organization-owner invitation.
- [x] Let the invited owner complete business details, create the first branch, and
      configure services, barbers, schedules, and public booking.
- [x] Present a tenant-scoped setup checklist derived from persisted configuration;
      do not reintroduce a global setup flag or endpoint.
- [x] Record onboarding approval, invitation, owner activation, first branch, and
      checklist milestones.

### Audited support access

- [x] Require a target organization, stated reason, expiry, provider actor, and
      immutable audit record before operational tenant access is granted.
- [x] Require organization-owner approval for ordinary support access and expose
      active and past grants to organization owners.
- [x] Restrict break-glass access to designated provider administrators, require a
      reason and short expiry, and create a visible incident record.
- [x] Re-evaluate every support request against the active grant, revoke or expire
      access automatically, and prevent a support grant from becoming a permanent
      membership.

## Acceptance criteria

- Tenant-only users cannot enter provider routes or call provider APIs.
- Provider administrators can manage lifecycle and onboarding metadata without
  receiving operational tenant data in default responses.
- Suspending an organization blocks all operational writes and public bookings
  while retaining owner-authorized reads and exports; reactivation follows an
  audited transition.
- An approved pilot can progress from organization creation through owner
  invitation, first branch configuration, and completion of a tenant-specific
  setup checklist.
- Ordinary support access is impossible before owner approval and expires at
  the recorded time. Break-glass use produces a visible incident and full audit
  history.
- Provider access tests prove a valid grant is scoped to its target tenant and
  cannot be reused for another organization or after expiry.

## Exclusions

- Public self-service tenant signup.
- Automated recurring billing, payment gateway integration, and tax invoices.
- Default provider access to tenant business or customer data.

## Pilot lifecycle policy

Trial expiry is represented by the persisted subscription and is reconciled by
the provider workflow; it does not delete tenant data. A provider may move a
trialing organization to `active`, `suspended`, or `archived`. Suspension keeps
authorized reads and exports available but rejects writes and public bookings.
Reactivation is an audited `suspended` → `active` transition. Archival is
terminal for normal operations and retains the organization, branches, and
history for the retention policy.

[Previous: Phase 9](phase-9-migration-authentication.md) · [SaaS roadmap](README.md) · [Next: Phase 11](phase-11-plans-billing.md)
