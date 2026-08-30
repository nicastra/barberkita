# Phase 4: Daily Operations

**Status: Planned**

[Previous: Phase 3](phase-3-customers-bookings.md) · [Roadmap index](README.md) · [Next: Phase 5](phase-5-checkout-payments.md)

## Objective

Give shop staff a clear day-of-work view and controlled appointment status flow
from arrival through service completion or cancellation.

## Dependencies

- Phase 3 provides customer-linked appointments, conflict-safe scheduling, and
  the initial booking lifecycle.

## Deliverables

- Day and calendar views of appointments with filters appropriate to front-desk
  and barber work.
- Staff check-in and a simple queue ordered by operational priority.
- Controlled transitions for confirmed, checked-in, in-service, completed,
  cancelled, and no-show outcomes.
- Walk-in intake using the same customer, service, barber, and conflict rules as
  scheduled appointments.
- Appointment detail and action views with clear empty, loading, stale-data,
  permission, and error states.
- Preservation of operational timestamps and the staff actor for significant
  status changes.

## Acceptance criteria

- Staff can see the shop's appointments for a selected day and reliably filter
  them by barber and operational status.
- Staff can add a walk-in, check a customer in, start service, and complete it
  only through valid status transitions.
- Cancellation and no-show handling preserve the appointment record and release
  future availability when appropriate.
- Conflicting or stale updates receive a clear response and do not silently
  overwrite newer operational state.
- The current queue and appointment details remain usable on common front-desk,
  tablet, and mobile viewport sizes.

## Exclusions

- Checkout, payment recording, refunds, and transaction corrections, which
  belong to Phase 5.
- Automated customer messaging and advanced waitlist optimization.
- Inventory consumption, room or chair allocation, and multi-branch operations.
- Employee time clocks, payroll, and commission calculation.

[Previous: Phase 3](phase-3-customers-bookings.md) · [Roadmap index](README.md) · [Next: Phase 5](phase-5-checkout-payments.md)
