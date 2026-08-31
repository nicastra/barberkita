# Phase 1: Authentication and Shop Setup

**Status: Completed**

[Previous: Phase 0](phase-0-foundation.md) · [Roadmap index](README.md) · [Next: Phase 2](phase-2-services-staff-availability.md)

## Objective

Secure the staff application and establish the single shop's identity, staff
accounts, and role-based access boundaries.

## Dependencies

- Phase 0 provides the runnable applications, database, API client, tooling, and
  application shell.

## Deliverables

- Staff sign-in, sign-out, session persistence, and secure credential handling.
- Authentication middleware and authorization rules for the MVP roles.
- Initial owner setup and controlled staff account administration.
- A single-shop profile with name, contact details, address, timezone, and
  operating context required by later scheduling work.
- A protected application layout with navigation and explicit loading, empty,
  unauthorized, and error states.
- Auditable security-sensitive actions without exposing credentials or session
  secrets.

## TODO

### Authentication and authorization

- [x] Add staff accounts with securely hashed passwords and generic sign-in errors.
- [x] Add expiring, revocable sessions with HttpOnly cookies and session persistence.
- [x] Protect API routes with authentication middleware and owner-only staff administration.
- [x] Add sign-in, sign-out, and session-aware client controls with explicit error states.

### Shop and staff setup

- [x] Add atomic first-owner setup for the single shop and its owner account.
- [x] Add protected shop profile read/update endpoints with validated contact, address, and timezone fields.
- [x] Add owner staff list/create/update/delete endpoints with role and active-state controls.

### Security and quality

- [x] Record sign-in, sign-out, shop, and staff changes in an audit log without secrets.
- [x] Add the Drizzle migration for shop, staff, session, and audit tables.
- [x] Add focused route tests for invalid credentials and authorization boundaries.
- [x] Add owner-facing shop and staff administration screens.

## Acceptance criteria

- A valid staff member can sign in, refresh a protected page without losing the
  session, and sign out.
- Invalid credentials return a generic error and do not reveal whether an
  account exists.
- Unauthenticated requests cannot reach protected APIs or screens, and staff
  cannot perform actions outside their role.
- An authorized owner can configure the one shop and manage the MVP staff
  accounts needed for operations.
- External authentication and profile input is validated, and secrets are not
  returned by APIs or written to logs.

## Exclusions

- Customer authentication, social login, enterprise identity providers, and
  multi-factor authentication.
- Multi-branch organizations or permissions spanning several shops.
- Staff services, working hours, and availability, which belong to Phase 2.
- Payroll, commissions, and workforce performance reporting.

[Previous: Phase 0](phase-0-foundation.md) · [Roadmap index](README.md) · [Next: Phase 2](phase-2-services-staff-availability.md)
