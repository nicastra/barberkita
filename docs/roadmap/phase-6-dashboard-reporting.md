# Phase 6: Dashboard and Reporting

**Status: Completed**

[Previous: Phase 5](phase-5-checkout-payments.md) · [Roadmap index](README.md) · [Next: Phase 7](phase-7-hardening-release.md)

## Objective

Convert operational and transaction data into dependable summaries that help
the shop understand today's workload, revenue, and service performance.

## Dependencies

- Phase 5 provides auditable completed-service transactions and payment data in
  addition to the operational history from earlier phases.

## Deliverables

- A daily operational dashboard covering upcoming appointments, queue state,
  completed work, cancellations, and no-shows.
- Revenue summaries based on valid transactions and corrections rather than
  current catalog prices.
- Staff performance summaries for completed services and attributed revenue.
- Service performance summaries for booking count, completion count, and
  attributed revenue.
- Consistent date-range filters interpreted in the shop timezone with documented
  inclusion rules.
- Responsive dashboard and report views with explicit loading, empty, partial,
  permission, and error states.

## TODO

### Dashboard and summaries

- [x] Add the daily operational dashboard and drill-down appointment views.
- [x] Add timezone-aware revenue summaries reconciled to valid transactions.
- [x] Add staff and service performance summaries with documented definitions.

### Staff workspace and quality

- [x] Add responsive dashboard and report screens through the centralized API layer.
- [x] Add focused tests for date boundaries, corrections, permissions, and empty ranges.

### Reporting definitions

- Date filters use the shop's IANA timezone. The selected start date begins at
  local midnight and the selected end date ends at the following local
  midnight, exclusive in database queries.
- Revenue sums recorded payments and subtracts append-only refunds or voids once.
- Performance counts scheduled bookings and completions, attributing net
  checkout payments to each booking's barber and service.

## Acceptance criteria

- Authorized staff can view today's operational totals and drill into the
  underlying appointments represented by them.
- Revenue for a date range reconciles with non-voided transaction history and
  reflects corrections exactly once.
- Staff and service summaries use documented definitions and reconcile with the
  same filtered source records.
- Date boundaries behave consistently in the shop timezone, including days that
  cross UTC boundaries.
- A valid range with no activity displays a useful empty state, while failed or
  unauthorized requests are distinguishable from zero results.

## Exclusions

- Forecasting, custom report builders, data warehouses, scheduled exports, and
  accounting or business-intelligence integrations.
- Payroll and commission calculations, even when staff revenue attribution is
  shown.
- CRM segmentation, automated campaigns, inventory analytics, and comparisons
  across branches.
- Release hardening and production operations, which belong to Phase 7.

[Previous: Phase 5](phase-5-checkout-payments.md) · [Roadmap index](README.md) · [Next: Phase 7](phase-7-hardening-release.md)
