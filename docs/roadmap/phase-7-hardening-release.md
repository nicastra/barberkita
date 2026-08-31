# Phase 7: Hardening and Release

**Status: Active**

[Previous: Phase 6](phase-6-dashboard-reporting.md) · [Roadmap index](README.md)

## Objective

Harden the completed end-to-end MVP, prove its critical workflows, and prepare a
secure, observable, recoverable production release for one shop.

## Dependencies

- Phases 0 through 6 provide the complete functional MVP and its established
  acceptance criteria.

## Deliverables

- Security review of authentication, authorization, sessions, secrets, CORS,
  error handling, dependencies, logging, and abuse-prone public endpoints.
- End-to-end validation of external input, domain invariants, database
  constraints, transactional writes, and migration behavior.
- Accessibility and responsive-behavior review of protected staff workflows and
  public self-booking, including keyboard, focus, labels, contrast, and error
  feedback.
- Automated unit, integration, and end-to-end coverage for the critical booking,
  operations, checkout, and reporting paths and representative failure cases.
- Environment-driven production build and deployment configuration with health
  checks, structured logs, and a reviewed migration procedure.
- Automated PostgreSQL backups with documented, tested restoration and defined
  operational ownership outside the repository.
- A release checklist and acceptance run covering both staff-managed and public
  customer journeys.

## TODO

### Security and correctness

- [x] Review authentication, authorization, sessions, secrets, CORS, errors,
      dependencies, logging, and abuse-prone public endpoints.
- [x] Validate external input, domain invariants, database constraints,
      transactional writes, and migration behavior end to end.

### Experience and coverage

- [x] Review accessibility and responsive behavior across protected and public
      workflows.
- [x] Add automated unit, integration, and end-to-end coverage for critical
      booking, operations, checkout, and reporting paths.

### Production and release

- [x] Add environment-driven deployment configuration, health checks,
      structured logs, and a reviewed migration procedure.
- [x] Document and test automated PostgreSQL backup and isolated restoration.
- [ ] Complete the release checklist and acceptance run for staff and public
      customer journeys.

The automated release journey, production image build and health smoke test,
and isolated restore drill pass. The final checkbox remains an operator gate for
the manual assistive-technology pass, production backup identifier, deployment
approval, and recorded release decision.

## Acceptance criteria

- Formatting, strict type checking, unit and integration tests, end-to-end tests,
  and production builds pass from documented commands in a clean environment.
- Security review findings that can compromise MVP data or access are resolved,
  and public endpoints have appropriate abuse controls.
- Core staff screens and public booking meet the agreed accessibility baseline
  and work at supported mobile, tablet, and desktop viewport sizes.
- The production deployment uses no committed secrets, reports application and
  database health, applies reviewed migrations safely, and emits useful logs
  without sensitive data.
- A backup can be restored into an isolated environment and the restored core
  records are verified.
- Release acceptance proves sign-in, shop setup, scheduling, staff booking,
  public self-booking, daily operations, checkout, corrections, and reports as
  one end-to-end single-shop workflow.

## Exclusions

- New feature scope beyond fixes required to meet the eight phases' acceptance
  criteria.
- Formal external compliance certification, contractual uptime guarantees, and
  multi-region disaster recovery.
- Native mobile applications and offline-first operation.
- Inventory, payroll or commissions, CRM automation, and multi-branch
  management; these remain post-MVP capabilities.

[Previous: Phase 6](phase-6-dashboard-reporting.md) · [Roadmap index](README.md)
