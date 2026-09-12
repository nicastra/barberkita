# CukurPro MVP Roadmap

This roadmap is the canonical source for the current phase and phase statuses of
the CukurPro single-shop MVP. Work advances sequentially, and only one phase may
be active across the MVP and SaaS roadmaps at a time.

The single-shop roadmap remains the implementation and release history for
Phases 0 through 7. The separate [SaaS roadmap](saas/README.md) plans Phases 8
through 15 for turning CukurPro into a multi-tenant platform. Phase 9's
migration, authorization, and acceptance gates are complete, Phase 10 is now
active, and the Phase 7 release gate remains paused.

## Phases

| Phase                                       | Scope                             | Status    |
| ------------------------------------------- | --------------------------------- | --------- |
| [0](phase-0-foundation.md)                  | Foundation                        | Completed |
| [1](phase-1-authentication-shop-setup.md)   | Authentication and Shop Setup     | Completed |
| [2](phase-2-services-staff-availability.md) | Services, Staff, and Availability | Completed |
| [3](phase-3-customers-bookings.md)          | Customers and Bookings            | Completed |
| [4](phase-4-daily-operations.md)            | Daily Operations                  | Completed |
| [5](phase-5-checkout-payments.md)           | Checkout and Payments             | Completed |
| [6](phase-6-dashboard-reporting.md)         | Dashboard and Reporting           | Completed |
| [7](phase-7-hardening-release.md)           | Hardening and Release             | Paused    |

## Status rules

- The index is the source of truth for whether a phase is `Planned`, `Active`,
  `Paused`, or `Completed`. Each phase header must mirror the status shown here.
- Exactly one phase is active. Phases advance sequentially.
- Only the active phase may contain unchecked task boxes. Planned phases describe
  deliverables with ordinary bullets and do not carry premature task checklists.
- A paused phase is an explicitly deferred active phase. It retains its checked
  implementation history, but its remaining work is recorded as ordinary
  pending bullets until the phase is resumed.
- Completed phases keep their fully checked task lists as implementation history.
- Advancing to the next phase is one documentation change: check every completed
  task in the old active phase, mark it completed here and in its phase file,
  mark the next phase active here and in its phase file, and convert that phase's
  deliverables into actionable TODO checklists.
- Do not invent dates, estimates, or owners when phases advance.
- When a paused phase is resumed, make it the only active phase. When Phase 7 is
  eventually completed, preserve this roadmap as historical documentation while
  advancing the active SaaS phase in the same documentation change.

## MVP boundary

The roadmap delivers an end-to-end experience for one shop. It includes both
appointments created by authenticated staff and simple public self-booking.
Inventory management, payroll and commission calculation, CRM or marketing
automation, and multi-tenant or multi-branch management are post-MVP
capabilities and are not part of these eight phases. Their planned sequence is
documented separately in the [SaaS roadmap](saas/README.md).

## Engineering guardrails

All implementation work must follow the existing [project structure](../project-structure.md)
and [coding conventions](../coding-conventions.md). In particular, keep
TypeScript strict without `any`; validate external input with Zod and
`@hono/zod-validator`; keep HTTP handlers thin and business logic in services;
use Drizzle and `.returning()` for writes; centralize frontend API calls; and
compose the UI from shadcn/ui primitives with Tailwind CSS utilities.

Endpoint shapes, database schemas, and other detailed contracts are finalized
when their relevant phase becomes active.
