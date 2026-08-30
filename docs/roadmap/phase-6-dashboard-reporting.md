# Phase 6: Dashboard and Reporting

**Status: Planned**

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
