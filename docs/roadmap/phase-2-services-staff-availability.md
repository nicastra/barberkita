# Phase 2: Services, Staff, and Availability

**Status: Completed**

[Previous: Phase 1](phase-1-authentication-shop-setup.md) · [Roadmap index](README.md) · [Next: Phase 3](phase-3-customers-bookings.md)

## Objective

Define what the shop sells, who can perform each service, and when staff can be
booked so appointment creation has a dependable source of availability.

## Dependencies

- Phase 1 provides authenticated staff, roles, the shop profile, and protected
  administration screens.

## Deliverables

- Service catalog management for active status, duration, and integer-rupiah
  price.
- Barber profiles connected to staff accounts where appropriate.
- Explicit service-to-barber eligibility assignments.
- Regular working hours plus dated schedule exceptions, breaks, and time off.
- A server-side availability service that evaluates shop timezone, duration,
  eligibility, working hours, exceptions, and existing reservations.
- Staff-facing schedule management using the centralized frontend API layer.

## TODO

### Services and barbers

- [x] Add service catalog persistence and protected management endpoints.
- [x] Add durable barber profiles linked optionally to staff accounts.
- [x] Add explicit service-to-barber eligibility assignments.

### Scheduling and availability

- [x] Add weekly working hours, recurring breaks, and dated schedule exceptions.
- [x] Add timezone-aware availability queries with eligibility and duration checks.
- [x] Exclude breaks, time off, and reservation intervals from offered slots.

### Staff workspace and quality

- [x] Add staff-facing service and schedule management screens through the centralized API layer.
- [x] Add the Drizzle migration for Phase 2 scheduling tables and constraints.
- [x] Add focused tests for authorization, inactive resources, and unavailable time ranges.

## Acceptance criteria

- Authorized staff can create, edit, deactivate, and view services and barber
  profiles without deleting historical identities.
- Money is stored and transferred as integer rupiah values, and service duration
  is positive and unambiguous.
- Each barber can be assigned eligible services, weekly hours, breaks, and dated
  exceptions.
- Availability queries return only eligible slots fully contained within
  working time and outside breaks or time off, interpreted in the shop timezone.
- Inactive services and barbers are not offered for new work.

## Exclusions

- Customer records and appointment creation, which belong to Phase 3.
- Walk-in queues and day-of operational status management.
- Resource scheduling beyond barbers, dynamic pricing, packages, and memberships.
- Payroll, commission rules, and multi-branch staff scheduling.

[Previous: Phase 1](phase-1-authentication-shop-setup.md) · [Roadmap index](README.md) · [Next: Phase 3](phase-3-customers-bookings.md)
