# Phase 5: Checkout and Payments

**Status: Planned**

[Previous: Phase 4](phase-4-daily-operations.md) · [Roadmap index](README.md) · [Next: Phase 6](phase-6-dashboard-reporting.md)

## Objective

Turn completed services into accurate, traceable transactions and record how
customers paid without introducing online payment processing.

## Dependencies

- Phase 4 provides completed appointments, service outcomes, customers, and the
  staff actors responsible for operational changes.

## Deliverables

- Checkout initiated from a completed service with an immutable snapshot of
  billable descriptions and integer-rupiah amounts.
- Server-calculated subtotal, permitted adjustment, and final total rules.
- Payment recording for the MVP payment methods, including reference details
  where relevant and protection against duplicate submission.
- Searchable transaction and receipt detail history linked to the appointment,
  customer, barber, and recording staff member.
- Controlled void or correction workflow that preserves the original financial
  record and records the reason and actor.
- Checkout UI with explicit unpaid, paid, validation, duplicate, and error
  states.

## Acceptance criteria

- Staff can check out a completed appointment and record a payment whose amount
  exactly matches the server-calculated total.
- All monetary values are integer rupiah in the database, API contracts, and
  calculations; floating-point monetary arithmetic is absent.
- Retrying a payment submission cannot create a duplicate transaction.
- Historical transactions retain their original line descriptions and prices
  even after a service catalog entry changes.
- Corrections are permission-controlled and append an auditable record rather
  than erasing or silently editing the original transaction.

## Exclusions

- Payment gateway integration, stored cards, split tenders, deposits, tips,
  invoices, and accounting-system integration.
- Revenue dashboards and performance reports, which belong to Phase 6.
- Product sales, inventory, gift cards, memberships, payroll, and commissions.
- Cross-branch settlement or consolidated finance.

[Previous: Phase 4](phase-4-daily-operations.md) · [Roadmap index](README.md) · [Next: Phase 6](phase-6-dashboard-reporting.md)
