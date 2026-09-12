# Phase 14: Barber Performance and Reporting

**Status: Planned**

[Previous: Phase 13](phase-13-receipts-pos.md) · [SaaS roadmap](README.md) · [Next: Phase 15](phase-15-retention-growth.md)

## Objective

Extend basic reporting into reconcilable branch and barber performance metrics
with explicit definitions and least-privilege access.

## Dependencies

- Phase 8 provides reliable organization and shop ownership paths.
- Phase 11 provides reporting entitlements.
- Phase 13 provides stable checkout, payment, refund, and receipt snapshots.

## Deliverables

### Metrics and definitions

- Report booking and completion counts, cancellation and no-show rates, net
  attributed revenue, and average net revenue per completed service.
- Report scheduled service minutes, actual service duration when reliable event
  timestamps exist, and utilization against effective working hours.
- Add period-over-period trends and booking-source breakdown.
- Allow organization owners to compare services, barbers, and branches using
  definitions that reconcile to branch-level detail.
- Interpret periods in each shop's IANA timezone and document handling for UTC
  boundaries, schedule exceptions, missing timestamps, reassignment, walk-ins,
  voids, partial payments, and refunds.
- Keep performance attribution distinct from payroll or commission
  calculation; revenue visibility does not define compensation.

### Access policy

- Let organization owners view and compare all authorized branches and barbers.
- Let shop managers view their branch only.
- Let barbers view only their own metrics and underlying permitted detail.
- Hide individual revenue from receptionists unless a future explicit grant
  adds that permission.
- Give provider administrators no performance access by default; a valid
  support grant remains required and is audited.
- Enforce every data boundary in report services and queries, not only in
  navigation or presentation.

### Reporting experience and correctness

- Provide consistent filters, metric definitions, empty and partial-data
  states, and drill-down paths that do not expand the caller's scope.
- Reconcile summaries against bookings, lifecycle timestamps, effective
  schedules and exceptions, checkout snapshots, payments, voids, and refunds.
- Add focused tests for timezones, period boundaries, reassignment, refunds,
  missing duration data, permissions, multi-branch comparison, and entitlement
  changes.

## Acceptance criteria

- Every displayed metric has a documented numerator, denominator, time basis,
  source records, and treatment of corrections and incomplete data.
- Revenue and count totals reconcile from organization comparison through
  branch, barber, service, and permitted detail views.
- Organization owners, shop managers, barbers, receptionists, and provider
  administrators receive exactly the defined data scope.
- Barbers cannot obtain peer metrics by changing report IDs or filters, and
  shop managers cannot retrieve another branch.
- Utilization uses effective working time after breaks and schedule exceptions
  and does not silently substitute scheduled duration for missing actual
  duration.
- Timezone and period-over-period tests cover branches whose local dates cross
  different UTC boundaries.

## Exclusions

- Payroll, wages, tips distribution, targets tied to compensation, and
  commission calculation.
- Forecasting, custom report builders, and a cross-tenant provider analytics
  warehouse.
- Default provider access to tenant revenue or individual performance.

[Previous: Phase 13](phase-13-receipts-pos.md) · [SaaS roadmap](README.md) · [Next: Phase 15](phase-15-retention-growth.md)
