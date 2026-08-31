# Production Operations

## Build and deploy

Copy `deploy/production.env.example` to the ignored `deploy/production.env`,
replace every placeholder, and URL-encode reserved characters in `DATABASE_URL`.
Origins and public API URLs must use their exact browser-reachable HTTPS values.

```sh
bun run check
docker compose --env-file deploy/production.env -f compose.production.yaml config --quiet
docker compose --env-file deploy/production.env -f compose.production.yaml build
docker compose --env-file deploy/production.env -f compose.production.yaml up -d
docker compose --env-file deploy/production.env -f compose.production.yaml ps
```

The database must become healthy before the one-shot `migrate` service runs.
The API starts only after migrations succeed, and the client starts after API
health succeeds. A migration failure stops deployment.

## Migration procedure

1. Create and verify a fresh backup.
2. Review every unapplied SQL file; never edit an applied migration.
3. Rehearse migration and application checks against an isolated restore.
4. Build immutable images and deploy through the migration service.
5. Confirm `GET /api/health`, sign-in, and a protected read request.
6. If migration fails, keep the application stopped, preserve logs, restore the
   pre-migration backup in isolation, and diagnose before retrying. Never
   manually mark a failed migration as applied.

Use backward-compatible schema changes when zero-downtime replacement is
required. Destructive cleanup belongs in a later migration after old code stops.

## Health and logs

- API `GET /api/health` returns `503` when the database is unavailable.
- Client `GET /health` reports static-server availability.
- PostgreSQL uses `pg_isready` inside its container.
- Production API logs are JSON objects with request ID, method, path, status,
  and duration. `X-Request-Id` supports incident correlation.

Forward container logs to the deployment platform and alert on repeated `5xx`,
health failures, and backup failures. Never enable request-body or authorization
header logging.
