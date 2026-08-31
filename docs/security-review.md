# Security Review

This review covers the Phase 7 single-shop MVP. Repeat it before each release
and after material authentication, public-booking, or infrastructure changes.

## Reviewed controls

- Passwords use Bun's password hashing and are never returned. Sign-in failures
  use one generic response, and session tokens are random, stored only as
  SHA-256 hashes, expire after seven days, and are invalidated after password
  changes or account deactivation.
- Session cookies are `HttpOnly`, `SameSite=Lax`, scoped to `/`, and `Secure` in
  production. Protected routes resolve the current account on every request, so
  deactivation and role changes take effect immediately.
- Owner-only route middleware is backed by service-level owner checks for staff
  administration. Initial setup uses a unique database claim to prevent two
  concurrent owners, and the last active owner cannot be removed.
- All path, query, and JSON inputs use Zod validators. Request bodies are capped
  before parsing, monetary values are integer rupiah, writes use Drizzle, and
  multi-write workflows use transactions.
- CORS allows only configured origins with credentials. API responses receive
  security headers, unexpected failures return generic messages, and production
  request logs omit query strings, bodies, cookies, authorization headers, and
  database errors.
- Sign-in, setup, and public endpoints use bounded in-memory rate limits. The
  reverse proxy must overwrite `X-Forwarded-For` or provide
  `CF-Connecting-IP`. A shared limiter is required before horizontal scaling.
- Secrets are environment-driven and excluded from Docker build contexts and
  version control. Production containers use fixed image versions,
  `no-new-privileges`, health checks, and read-only API storage.

## Release review commands

```sh
bun run check:release
bun audit
```

Review dependency advisories using current registry tooling in a network-enabled
release environment. Resolve or document every reachable high-impact finding.

The Phase 7 audit resolved `GHSA-gpj5-g38j-94v9` by upgrading `drizzle-orm` to
0.45.2. `GHSA-67mh-4wv8-2f99` remains in an old esbuild executable nested under
`drizzle-kit`; it affects an exposed development server. CukurPro never runs
that executable as a server: production images contain a bundled API, static
Nginx assets, and a one-shot migration command. Do not expose Vite or other
development servers to untrusted networks, and remove the exception when the
upstream migration tool drops that dependency.

## Residual risks and operating requirements

- Rate-limit state is process-local. Run one API replica for the MVP or move
  limits to the ingress or a shared store before scaling.
- TLS terminates outside this repository. Expose only HTTPS, overwrite
  forwarding headers, and restrict direct access to the API port.
- Use a secret manager and least-privilege database roles where available.
- Logs and backups may contain operational metadata or customer data. Restrict
  access, define retention outside the repository, and monitor backup jobs.
