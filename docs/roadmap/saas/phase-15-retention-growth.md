# Phase 15: Retention and Operational Growth

**Status: Planned**

[Previous: Phase 14](phase-14-barber-performance.md) · [SaaS roadmap](README.md)

## Objective

Add the first retention, communication, reconciliation, export, and aggregate
usage capabilities after tenant isolation and the core SaaS experience are
stable.

## Dependencies

- Phases 8 through 14 provide secure tenant identity, scoped public booking,
  lifecycle and plan controls, stable transaction history, and reconciled
  reporting definitions.

## Prioritized deliverables

1. Add unguessable, expiring customer links for viewing, cancelling, and
   rescheduling only the intended booking, with revocation and audit history.
2. Add WhatsApp confirmations and reminders with consent-aware templates,
   delivery history, idempotency keys, bounded retries, and failure visibility.
3. Add tenant-scoped customer visit history, preferred barber, last visit, and
   lifetime spending reconciled to valid transaction history.
4. Add a simple visit-based loyalty or digital-stamp model with append-only
   earning and redemption history and explicit correction behavior.
5. Add end-of-day cash reconciliation with expected cash, counted cash,
   variance, closer identity, notes, and immutable correction history.
6. Add authorized CSV exports for transactions, customers, and reports with
   tenant filters, safe spreadsheet encoding, audit events, and plan or
   retention checks.
7. Add provider-visible aggregate product-usage metrics that cannot reveal
   customer data, bookings, payments, tenant revenue, or barber performance.

Each capability must reuse tenant context, lifecycle state, roles, plan
entitlements, audit logging, and idempotency conventions established by earlier
phases. Communication jobs and exports must capture tenant scope explicitly and
must not depend on ambient pooled-connection state.

## Acceptance criteria

- Customer links authorize one intended booking and action, expire and revoke
  correctly, and cannot enumerate other bookings or tenants.
- Reminder retries do not send duplicate messages for the same intended event,
  and delivery history is visible to authorized tenant users.
- Visit history, spending, loyalty, and cash reconciliation remain correct
  after voids, refunds, cancellations, and authorized corrections.
- CSV exports contain only the caller's authorized organization or branch data,
  resist spreadsheet formula injection, and leave an audit record.
- Provider usage metrics are aggregated to the documented privacy threshold and
  expose no operational tenant records or individual performance.
- Suspension, membership removal, plan changes, and retention policy are
  enforced consistently in synchronous requests and background jobs.

## Later opportunities

- Automated subscription billing, invoices, payment retries, taxes, and payment
  gateway webhooks.
- Commissions and payroll.
- Inventory and product sales.
- Promotions, referrals, and advanced CRM campaigns.
- Custom booking domains and white-label storefronts.
- Accounting integrations.
- Native or offline-first applications.

## Exclusions

- Treating any later opportunity as committed scope without a new roadmap gate
  and validated product need.
- Cross-tenant marketing lists or provider access to raw tenant business data.

[Previous: Phase 14](phase-14-barber-performance.md) · [SaaS roadmap](README.md)
