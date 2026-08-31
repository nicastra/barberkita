# Phase 3: Customers and Bookings

**Status: Completed**

[Previous: Phase 2](phase-2-services-staff-availability.md) · [Roadmap index](README.md) · [Next: Phase 4](phase-4-daily-operations.md)

## Objective

Let staff maintain customer records and create appointments while also offering
a simple public self-booking flow that cannot double-book a barber.

## Dependencies

- Phase 2 provides services, eligible barbers, schedules, and authoritative
  availability calculations.

## Deliverables

- Customer records with normalized contact details, notes appropriate for shop
  operations, search, and duplicate-aware creation.
- Authenticated staff booking creation and editing from customer records.
- A public self-booking flow for selecting a service, barber or available
  barber, date and time, and providing customer contact details.
- Server-authoritative availability revalidation and transactional conflict
  prevention for every booking channel.
- A defined booking lifecycle with initial, confirmed, rescheduled, and
  cancelled transitions needed before daily operations.
- Clear confirmation, validation, unavailable-slot, empty, and error experiences
  for staff and public users.

## TODO

### Customers and appointments

- [x] Add searchable, duplicate-aware customer records with normalized contact details.
- [x] Add the booking lifecycle and UTC appointment persistence.
- [x] Add authenticated staff booking, rescheduling, and cancellation endpoints.

### Public booking and conflicts

- [x] Add public service, barber, date, and available-slot selection.
- [x] Revalidate availability and prevent overlapping barber reservations transactionally.
- [x] Return stable conflict responses and complete booking confirmations.

### User experience and quality

- [x] Add staff customer and appointment screens through the centralized API layer.
- [x] Add the public self-booking flow with validation, empty, and error states.
- [x] Add the Drizzle migration and focused concurrency and lifecycle tests.

## Acceptance criteria

- Authorized staff can find or create a customer and create, view, reschedule,
  or cancel that customer's appointment.
- A public customer can complete a booking without a staff account and receives
  a confirmation containing the selected shop, service, barber, and local time.
- Staff-managed and public bookings apply the same availability and conflict
  rules on the server.
- Concurrent attempts cannot reserve overlapping time for the same barber; a
  losing request receives a stable conflict response and can choose another
  slot.
- Appointment times are stored as UTC moments and displayed in the shop
  timezone, with past or inactive options rejected.

## Exclusions

- Customer accounts, saved payment methods, waitlists, recurring appointments,
  group bookings, and automated reminders.
- Walk-in check-in, queues, and in-service status handling, which belong to
  Phase 4.
- Online payment collection and checkout.
- CRM campaigns, loyalty programs, and marketing automation.

[Previous: Phase 2](phase-2-services-staff-availability.md) · [Roadmap index](README.md) · [Next: Phase 4](phase-4-daily-operations.md)
