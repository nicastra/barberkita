# CukurPro SaaS Roadmap

This roadmap plans the work required to evolve the single-shop MVP into a
multi-tenant SaaS operated by the CukurPro provider. It is separate from the
[single-shop MVP roadmap](../README.md), which remains the implementation and
release history for Phases 0 through 7.

Phase 10 is the only active phase across both roadmaps. Phase 9's migration and
authentication gates are complete after verification of migration, authorization,
and acceptance behavior. Phase 7's single-shop release gate is explicitly paused
and remains required before a production MVP release. Phase 8's foundation work
is complete.

## Target hierarchy

```text
CukurPro Provider
└── Customer Organization
    ├── Shop Branch
    │   ├── Staff and Barbers
    │   ├── Customers and Bookings
    │   └── Checkouts and Transactions
    └── Additional Shop Branches
```

An organization is the paying customer business. A shop is one physical branch
of that business. A global user identity may hold memberships in several
organizations and shops without duplicated credentials.

## Phases

| Phase                                    | Scope                                      | Status    |
| ---------------------------------------- | ------------------------------------------ | --------- |
| [8](phase-8-multi-tenant-foundation.md)  | Multi-Tenant Foundation                    | Completed |
| [9](phase-9-migration-authentication.md) | Migration and SaaS Authentication          | Completed |
| [10](phase-10-provider-onboarding.md)    | Provider Console and Pilot Onboarding      | Active    |
| [11](phase-11-plans-billing.md)          | Plans, Limits, and Manual Billing          | Planned   |
| [12](phase-12-storefront-dashboard.md)   | Public Storefront and Dashboard Experience | Planned   |
| [13](phase-13-receipts-pos.md)           | Printable Receipts and POS Improvements    | Planned   |
| [14](phase-14-barber-performance.md)     | Barber Performance and Reporting           | Planned   |
| [15](phase-15-retention-growth.md)       | Retention and Operational Growth           | Planned   |

## Phase and release gates

- The status table is the source of truth. Each phase header must mirror it.
- Exactly one phase may be `Active` across the MVP and SaaS roadmaps.
- A phase may be explicitly `Paused` by a product decision. Its unfinished work
  remains pending and it cannot carry unchecked task boxes.
- Phase 10 is active by the current roadmap decision. Before a production MVP
  release, resume Phase 7, complete its manual gate, and record the release
  decision.
- Planned phases use ordinary deliverable bullets. When a phase becomes active,
  convert its deliverables into actionable checklists without changing the
  agreed scope.
- A phase becomes completed only after its acceptance criteria and required
  isolation tests pass. Advance the next phase in the same documentation
  change.
- Do not invent dates, estimates, or owners when phases advance.

## Platform boundaries

The initial SaaS architecture uses one PostgreSQL database with shared tables.
Isolation is enforced through tenant-aware service queries, database
constraints, authorization middleware, and request-scoped Row-Level Security
where practical. Tenant context must be transaction-local so a pooled
connection cannot carry it into another request.

The API namespaces make scope explicit:

- `/api/organizations/:organizationId/*` for organization administration;
- `/api/shops/:shopId/*` for authenticated branch operations;
- `/api/public/shops/:shopSlug/*` for public storefront and booking;
- `/api/provider/*` for provider administration.

Protected frontend routes use `/app/:shopSlug/*`; public storefronts use
`/s/:shopSlug`. Middleware derives an authorized tenant context from the global
session and current memberships. A client-provided organization ID, shop ID, or
slug selects a candidate scope but never grants access by itself.

## Role boundaries

- `platform_admin` is a provider role and is never implied by a tenant role.
- `organization_owner` controls organization settings, branches, subscription,
  ownership, and organization membership.
- `organization_admin` manages branches and members but not ownership or
  subscription authority.
- `organization_member` receives operational access through shop membership.
- `shop_manager` manages branch settings, catalog, schedules, reports, and
  staff.
- `receptionist` manages customers, bookings, queues, checkout, and receipts.
- `barber` manages permitted appointments and sees only personal performance.

Provider administrators see tenant metadata by default, not customer names,
bookings, payments, revenue, or barber performance. Operational support access
requires a time-limited, audited grant.

## Mandatory isolation acceptance suite

These checks are release requirements for the relevant phases and must remain
in regression coverage afterward:

- Changing an organization or shop identifier cannot expose another tenant's
  resources.
- A user with several memberships receives the correct active organization and
  branch context on every request.
- Membership removal and role changes take effect immediately.
- A public slug resolves services and availability for only its branch.
- A booking cannot combine a customer, service, barber, or schedule from
  different shops.
- Provider endpoints reject tenant-only users, and provider administrators
  cannot read operational data without an active support grant.
- Support access expires automatically and leaves a complete audit trail.
- PostgreSQL tenant context cannot leak through pooled connections.
- Suspension blocks operational writes and public bookings while retaining
  authorized read and export behavior.
- Migration preserves all bookings, customers, checkouts, payments, and audit
  records and leaves no cross-tenant relationships.
- Plan limits remain correct under concurrent requests.
- Backup and restore preserve all organizations and tenant boundaries.

## Product assumptions

- CukurPro is operated by a platform provider and each customer organization may
  run multiple branches.
- Initial organization onboarding is provider-approved.
- Plans, trials, renewals, and manual payments ship before automated recurring
  billing or payment-gateway webhooks.
- Image uploads, custom domains, direct Bluetooth or ESC/POS printing, payroll,
  and commissions are deferred until their prerequisites are validated.
- Tenancy precedes storefront, receipts, and advanced reports so those features
  are not built twice around the single-shop assumption.

[MVP roadmap](../README.md) · [Current: Phase 10](phase-10-provider-onboarding.md)
