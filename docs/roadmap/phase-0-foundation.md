# Phase 0: Foundation

**Status: Completed**

[Roadmap index](README.md) · [Next: Phase 1](phase-1-authentication-shop-setup.md)

## Objective

Create a reliable, documented development baseline for the Bun workspace,
Hono API, React application, and PostgreSQL database so later product work can
start from a tested application shell.

## Dependencies

- None. This is the first phase.

## Deliverables

- A Bun workspace with separate client and server packages and shared root
  commands.
- A Hono server with environment configuration, shared middleware, error
  handling, and a health endpoint.
- A React, Vite, Tailwind CSS, and shadcn/ui client with a responsive application
  shell and API connectivity state.
- PostgreSQL and Drizzle configuration with an initial migration workflow.
- Safe environment examples, baseline formatting and type-checking tools, and
  automated tests for the initial vertical slice.

## TODO

### Backend

- [x] Scaffold the strict TypeScript Hono server package and entry point.
- [x] Load and validate `PORT`, `DATABASE_URL`, and allowed origins from the
      environment.
- [x] Configure CORS, request logging, a global error handler, and reusable
      PostgreSQL connection handling.
- [x] Add a health endpoint that distinguishes application health from database
      connectivity.

### Frontend

- [x] Scaffold the strict TypeScript React and Vite client package.
- [x] Configure Tailwind CSS, shadcn/ui, theme tokens, and the shared `cn()`
      helper.
- [x] Build a responsive application shell with explicit loading, connected,
      and connection-error states.
- [x] Add the centralized typed API client and use it for the health request.

### Database

- [x] Configure Drizzle for PostgreSQL with schema and migration directories.
- [x] Establish the initial schema needed to verify migrations and database
      health without modeling later product domains prematurely.
- [x] Generate and review the initial Drizzle migration.
- [x] Apply the initial Drizzle migration to a development PostgreSQL database.

### Tooling

- [x] Define root Bun workspace scripts for development, build, formatting,
      type checking, tests, and database migrations.
- [x] Add safe root, client, and server environment examples where applicable.
- [x] Configure ignore rules for secrets, dependencies, builds, coverage, and
      local PostgreSQL data.
- [x] Add baseline formatter, linter if selected, and strict TypeScript
      configuration for both applications.

### Tests

- [x] Add server tests for a successful health response and a database failure
      response.
- [x] Add a client test covering the application shell's connected and error
      states.
- [x] Verify formatting, type checking, tests, and production builds through the
      root workspace commands.

### Documentation

- [x] Document prerequisites, environment setup, database startup, migrations,
      development commands, tests, and production builds.
- [x] Reconcile the implemented workspace layout and commands with the project
      structure and coding convention documents.

## Acceptance criteria

- A new contributor can configure the documented environment, start PostgreSQL,
  apply migrations, and run both applications using only documented commands.
- The browser renders the application shell and reports API/database
  connectivity without calling `fetch` directly from a component.
- The health route validates configuration, returns a predictable response, and
  does not expose database or stack-trace details on failure.
- Root commands complete formatting, strict type checking, relevant tests, and
  production builds successfully.
- No `.env` file, credential, build output, dependency directory, or local
  database data is committed.

## Exclusions

- Authentication, authorization, roles, and shop profile management.
- Service, staff, schedule, customer, booking, payment, and reporting models.
- Production deployment and release acceptance, which belong to Phase 7.
- Inventory, payroll or commissions, CRM automation, and multi-branch support.

[Roadmap index](README.md) · [Next: Phase 1](phase-1-authentication-shop-setup.md)
