# Coding Conventions

These rules favor consistency and a small MVP codebase over unnecessary
abstraction.

## General

- Use TypeScript strict mode.
- Prefer small, focused functions and explicit types at module boundaries.
- Do not use `any`; use a real type or `unknown` with validation.
- Use `camelCase` for variables and functions, `PascalCase` for components and
  types, and `UPPER_SNAKE_CASE` for true constants.
- Use descriptive names. Avoid abbreviations that are not part of the domain.
- Keep one React component per file. A small private helper component may stay
  in the same file when it is not reused.
- Remove dead code instead of commenting it out.

## Backend

### Routes

- Use one route module per domain, such as `routes/bookings.ts`.
- Register domain routers under `/api/<domain>` in `server/src/index.ts`.
- Validate body, path, and query input with Zod and
  `@hono/zod-validator` before calling a service.
- Return the created resource with `201`, successful reads/updates with `200`,
  and successful deletes with `204` unless a response body is useful.
- Use `400` for invalid input, `404` for missing resources, and `409` for domain
  conflicts. Let unexpected failures reach the global error handler.

### Services and PostgreSQL

- Put business decisions and multi-step operations in `services/`.
- Keep database queries out of React code and HTTP response formatting out of
  services.
- Define tables with `drizzle-orm/pg-core` and access PostgreSQL through
  Drizzle's query builder.
- Use Drizzle's `sql` template only when the query builder cannot express a
  PostgreSQL query clearly. Never build SQL by concatenating user input.
- Use `.returning()` for inserts and updates.
- Use a PostgreSQL transaction when several writes must succeed or fail
  together.
- Use `snake_case` for PostgreSQL tables, columns, indexes, and constraints.
- Prefer generated identity columns or UUIDs for primary keys; do not use
  application-generated sequential IDs.
- Use `timestamptz` for moments in time and store them in UTC. Use `date` only
  for calendar dates that have no time component.
- Store money as integer rupiah values. Never use PostgreSQL `real` or
  `double precision` for monetary amounts.
- Use `jsonb` only for genuinely flexible data, not as a replacement for
  relational tables and foreign keys.
- Enforce domain invariants with `NOT NULL`, foreign keys, unique constraints,
  and check constraints where practical.
- Define deliberate `ON DELETE` behavior for every foreign key. Do not cascade
  deletes unless deleting the related records is part of the domain rule.
- Add indexes for foreign keys and frequently filtered, joined, or sorted
  columns. Avoid indexes that are not justified by a query.
- Generate a Drizzle migration for every schema change. Review the generated
  SQL and apply migrations in development before merging.
- Never edit an already-applied migration or use schema push in production;
  create a new migration instead.

### Application setup

- Configure CORS, shared middleware, route registration, and global error
  handling in `server/src/app.ts`. Keep environment and process startup wiring
  in `server/src/index.ts` so the application can be tested without opening a
  network port.
- Read `PORT`, the PostgreSQL `DATABASE_URL`, and allowed origins from
  environment variables.
- Reuse a configured PostgreSQL connection pool instead of opening a connection
  for each request. Set a finite connection and query timeout.
- Log the original unexpected error on the server, but return a generic message
  to the client.

## Frontend

- Use functional components and hooks.
- Keep pages focused on composition; move reusable behavior into feature hooks
  or components.
- Use shadcn/ui components as accessible UI primitives. Keep them in
  `components/ui/` and compose them outside that folder for application UI.
- Use Tailwind CSS utilities for component styling and theme tokens for shared
  colors, spacing, and radii.
- Use the `cn()` helper when class names are conditional or need to be merged.
- Add new shadcn/ui primitives through the shadcn CLI so configuration and
  dependencies remain consistent.
- Do not call `fetch` directly from components. Use a typed module in `api/`.
- Represent loading, empty, error, and success states explicitly.
- Keep state local unless multiple distant components genuinely share it.
- Use controlled fields for forms and show validation errors near the relevant
  input.
- Avoid one-off CSS files when Tailwind utilities are sufficient. Keep global
  CSS for Tailwind imports, theme variables, resets, and truly global rules.
- Reserve inline styles for values calculated at runtime that cannot be
  represented cleanly with Tailwind classes.

### Routing and pages

- Use `react-router-dom` for client-side routing. Define the route tree and the
  shared application layout in `App.tsx` (or a dedicated routing module when
  the tree grows).
- Keep one route-level screen per file in `pages/`, such as
  `pages/BookingsPage.tsx` or `pages/OwnerAdminPage.tsx`. Pages compose feature
  components; they do not contain reusable domain controls or direct `fetch`
  calls.
- Put shared layout elements such as navigation, loading shells, and route
  guards in `components/shared/`. Use a reusable protected-route component for
  authentication and role checks rather than duplicating redirects in pages.
- Use `Link` or `NavLink` for internal navigation. Do not call
  `window.history.pushState` or manipulate the URL manually for application
  routes.
- Add an explicit not-found route and render loading, unauthorized, and error
  states at the appropriate route boundary.
- Keep route paths stable and descriptive. Use route parameters for resource
  identity and query parameters for filters, pagination, and view state.

## API contracts

- Use JSON for request and response bodies.
- Keep response shapes predictable within a domain.
- Serialize PostgreSQL `timestamptz` values as ISO 8601 strings with a timezone
  or UTC offset.
- Represent money as integer rupiah values in API contracts, never
  floating-point values.
- Use stable machine-readable error codes when the frontend must react to a
  specific domain error.

Example error response:

```json
{
  "error": {
    "code": "BOOKING_TIME_UNAVAILABLE",
    "message": "The selected time is no longer available."
  }
}
```

## Environment and security

- Put safe defaults in `.env.example`; never put secrets in it.
- Never commit `.env` files, PostgreSQL credentials, dumps, or local data
  volumes.
- Do not expose stack traces, SQL errors, or secret values in API responses.
- Treat all client input as untrusted, even when the frontend already validates
  it.

## Before finishing a change

1. Run formatting, type checking, and relevant tests.
2. Test changed API behavior, including one failure case.
3. Confirm migrations are included when the schema changed.
4. Update documentation when structure, commands, or behavior changed.
