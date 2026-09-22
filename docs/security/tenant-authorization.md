# Tenant authorization contract

Phase 8 establishes these stable errors for namespaced requests:

| Code                         | Meaning                                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `TENANT_ACCESS_DENIED`       | The authenticated user has no active membership in the requested scope. The `reason` field is `MEMBERSHIP_REQUIRED` or `INVALID_SCOPE`. |
| `TENANT_ROLE_FORBIDDEN`      | The user is a member, but their organization or shop role cannot perform the operation.                                                 |
| `ORGANIZATION_SUSPENDED`     | The organization is suspended. Reads remain available; operational writes are rejected.                                                 |
| `PUBLIC_BOOKING_UNAVAILABLE` | The requested shop slug is unknown, archived, or has no active public booking scope.                                                    |
| `PROVIDER_ACCESS_DENIED`     | The request is not authenticated as an explicitly registered platform administrator.                                                    |

Route parameters and public slugs only select a candidate scope. The tenant
middleware resolves current memberships and lifecycle state from the database,
then places the verified context on the request before the service is called.
The database helper sets matching PostgreSQL settings with `set_config(...,
true)` inside a transaction, so pooled connections cannot retain scope after a
commit or rollback.
