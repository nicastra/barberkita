# CukurPro MVP Roadmap

This roadmap is the canonical source for the current phase and phase statuses of
the CukurPro single-shop MVP. Work advances sequentially, and only one phase may
be active at a time.

## Phases

| Phase                                       | Scope                             | Status     |
| ------------------------------------------- | --------------------------------- | ---------- |
| [0](phase-0-foundation.md)                  | Foundation                        | Completed  |
| [1](phase-1-authentication-shop-setup.md)   | Authentication and Shop Setup     | Completed  |
| [2](phase-2-services-staff-availability.md) | Services, Staff, and Availability | Completed  |
| [3](phase-3-customers-bookings.md)          | Customers and Bookings            | Completed  |
| [4](phase-4-daily-operations.md)            | Daily Operations                  | Completed  |
| [5](phase-5-checkout-payments.md)           | Checkout and Payments             | Completed  |
| [6](phase-6-dashboard-reporting.md)         | Dashboard and Reporting           | Completed  |
| [7](phase-7-hardening-release.md)           | Hardening and Release             | **Active** |

## Status rules

- The index is the source of truth for whether a phase is `Planned`, `Active`,
  or `Completed`. Each phase header must mirror the status shown here.
- Exactly one phase is active. Phases advance sequentially.
- Only the active phase may contain unchecked task boxes. Planned phases describe
  deliverables with ordinary bullets and do not carry premature task checklists.
- Completed phases keep their fully checked task lists as implementation history.
- Advancing to the next phase is one documentation change: check every completed
  task in the old active phase, mark it completed here and in its phase file,
  mark the next phase active here and in its phase file, and convert that phase's
  deliverables into actionable TODO checklists.
- Do not invent dates, estimates, or owners when phases advance.

## MVP boundary

The roadmap delivers an end-to-end experience for one shop. It includes both
appointments created by authenticated staff and simple public self-booking.
Inventory management, payroll and commission calculation, CRM or marketing
automation, and multi-branch management are post-MVP capabilities and are not
part of these eight phases.

## Engineering guardrails

All implementation work must follow the existing [project structure](../project-structure.md)
and [coding conventions](../coding-conventions.md). In particular, keep
TypeScript strict without `any`; validate external input with Zod and
`@hono/zod-validator`; keep HTTP handlers thin and business logic in services;
use Drizzle and `.returning()` for writes; centralize frontend API calls; and
compose the UI from shadcn/ui primitives with Tailwind CSS utilities.

Endpoint shapes, database schemas, and other detailed contracts are finalized
when their relevant phase becomes active.
