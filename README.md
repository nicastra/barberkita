# CukurPro

CukurPro is a single-shop barbershop management MVP. The Bun workspace contains
a Hono API, React client, and a PostgreSQL database managed with Drizzle
migrations. Phase 1 adds staff authentication and shop setup.

## Prerequisites

- [Bun](https://bun.com/) 1.3 or newer
- Docker with Docker Compose, or a PostgreSQL 17 instance you manage yourself

## First-time setup

1. Install workspace dependencies:

   ```sh
   bun install
   ```

2. Create local environment files from the safe examples:

   ```sh
   cp .env.example .env
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

3. Start PostgreSQL:

   ```sh
   docker compose up -d database
   ```

   If you use an existing PostgreSQL server, update `DATABASE_URL` in
   `server/.env` instead. Do not commit that file.

4. Apply the committed migrations:

   ```sh
   bun run db:migrate
   ```

5. Start the API and browser client together:

   ```sh
   bun run dev
   ```

   The client runs at <http://localhost:5173>, the API runs at
   <http://localhost:3000>, and the health endpoint is available at
   <http://localhost:3000/api/health>.

To create repeatable local test data (one shop, one owner, and two staff
accounts), run `bun run db:seed`. The seed reads the `SEED_*` values in
`server/.env`. The example file includes development-only credentials for
`owner@cukurpro.local`, `staff@cukurpro.local`, and
`reception@cukurpro.local`; replace them for any shared or non-local
environment.

The application shell reports three distinct states: checking connectivity,
fully operational, or an API/database connection problem. A database failure
returns a generic degraded response and never returns connection details.

## Phase 1 API

The first owner can initialize the shop once with `POST /api/auth/setup`. Staff
then use `POST /api/auth/sign-in`, `POST /api/auth/sign-out`, and `GET
/api/auth/me`; the server keeps the session in an HttpOnly cookie. Authenticated
users can read `GET /api/shop`, while owners can update the shop and manage
staff through `/api/auth/staff`. Passwords and session tokens are never returned
by the API. Security-sensitive changes are recorded in `audit_logs`.

After signing in as an owner, the browser shows the owner administration
workspace with editable shop profile fields, staff account creation, role
changes, and account removal. Non-owner staff only see the sign-in/session
controls and cannot access that workspace.

## Environment variables

| File          | Variable            | Purpose                                         |
| ------------- | ------------------- | ----------------------------------------------- |
| `.env`        | `POSTGRES_DB`       | Local Compose database name                     |
| `.env`        | `POSTGRES_USER`     | Local Compose database user                     |
| `.env`        | `POSTGRES_PASSWORD` | Local-only Compose password                     |
| `.env`        | `POSTGRES_PORT`     | Host port exposed by Compose                    |
| `server/.env` | `PORT`              | Hono API port                                   |
| `server/.env` | `DATABASE_URL`      | PostgreSQL connection URL                       |
| `server/.env` | `ALLOWED_ORIGINS`   | Comma-separated browser origins allowed by CORS |
| `client/.env` | `VITE_API_BASE_URL` | Base URL used by the centralized API client     |

All server environment input is validated at startup. Keep real credentials in
untracked `.env` files or the deployment platform's secret manager.

## Workspace commands

| Command                | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `bun run dev`          | Run the client and server in watch mode              |
| `bun run format`       | Format the workspace                                 |
| `bun run format:check` | Check formatting without modifying files             |
| `bun run typecheck`    | Strictly type-check both applications                |
| `bun run test`         | Run backend and frontend tests                       |
| `bun run build`        | Create production builds for both applications       |
| `bun run check`        | Run formatting, types, tests, and builds             |
| `bun run db:generate`  | Generate a migration after a reviewed schema change  |
| `bun run db:migrate`   | Apply committed migrations to `DATABASE_URL`         |
| `bun run db:seed`      | Upsert local demo shop and owner/staff test accounts |

Generated migrations are committed under `server/drizzle/`. Never edit an
already-applied migration; change the Drizzle schema and generate a new one.

## Production builds

Run `bun run build`. The static client output is written to `client/dist/`, and
the Bun server bundle is written to `server/dist/`. Deployment configuration and
production operations are intentionally deferred to Phase 7.

## Troubleshooting

- If the shell says the API cannot be reached, confirm the server is running and
  `VITE_API_BASE_URL` matches its URL.
- If the API is online but the database is unavailable, confirm PostgreSQL is
  healthy, `DATABASE_URL` is correct, and `bun run db:migrate` has completed.
- If the browser blocks a request, add its exact origin to `ALLOWED_ORIGINS` and
  restart the server.

See [project documentation](docs/README.md) for structure, coding conventions,
and the phased MVP roadmap.
