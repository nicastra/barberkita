# Phase 10: Provider Console and Pilot Onboarding

**Status: Active**

[Previous: Phase 9](phase-9-migration-authentication.md) · [SaaS roadmap](README.md) · [Next: Phase 11](phase-11-plans-billing.md)

## Objective

Give designated CukurPro administrators a metadata-first provider console and a
controlled pilot-onboarding workflow while keeping tenant operations private by
default.

## Dependencies

- Phase 9 provides migrated global users, secure invitations, memberships,
  explicit provider identities, and complete authorization audit events.

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

[Previous: Phase 9](phase-9-migration-authentication.md) · [SaaS roadmap](README.md) · [Next: Phase 11](phase-11-plans-billing.md)
