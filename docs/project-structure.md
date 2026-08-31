# Project Structure

CukurPro uses a simple workspace with separate backend and frontend applications.
Organize code by responsibility first and by business domain within each folder.

```text
barberkita/
├── client/                     # React application
│   ├── src/
│   │   ├── api/                # HTTP client and domain API modules
│   │   ├── components/
│   │   │   ├── ui/             # shadcn/ui primitives
│   │   │   └── shared/         # Reusable application components
│   │   ├── features/           # Feature-specific UI and hooks
│   │   ├── lib/                # Frontend helpers, including cn()
│   │   ├── pages/              # Route-level screens
│   │   ├── types/              # Frontend-only TypeScript types
│   │   ├── App.tsx             # Application routes and layout
│   │   ├── main.tsx            # Browser entry point
│   │   └── index.css           # Tailwind and theme variables
│   ├── .env.example
│   ├── Dockerfile              # Production static-client image
│   ├── nginx.conf              # SPA and client health configuration
│   ├── components.json         # shadcn/ui configuration
│   └── vite.config.ts
├── server/                     # Hono API
│   ├── src/
│   │   ├── db/                 # Connection and Drizzle schema
│   │   ├── middleware/         # Shared HTTP middleware
│   │   ├── routes/             # Request/response handling by domain
│   │   ├── schemas/            # Reusable Zod request schemas
│   │   ├── services/           # Business rules and database operations
│   │   ├── app.ts              # API composition without process startup
│   │   └── index.ts            # Environment wiring and server entry point
│   ├── drizzle/                # Generated SQL migrations
│   ├── .env.example
│   ├── Dockerfile              # API runtime and migration image targets
│   └── drizzle.config.ts
├── docs/                       # Project documentation
├── deploy/                     # Safe production environment templates
├── e2e/                        # Real-database HTTP acceptance tests
├── scripts/                    # Release, backup, and restore automation
├── compose.yaml                # Local PostgreSQL service
├── compose.e2e.yaml            # Disposable acceptance-test database
├── compose.production.yaml     # Migration-gated production services
├── package.json                # Workspace scripts and dependencies
├── README.md                   # Setup and command reference
└── AGENTS.md                   # Short instructions for coding agents
```

Only create a directory when it has a real use. Empty placeholder folders are
not required.

## Backend placement

Use the same domain name across backend layers so related files are easy to
find. For example, booking code belongs in:

```text
server/src/routes/bookings.ts
server/src/schemas/bookings.ts
server/src/services/booking-service.ts
```

The request flow is:

```text
HTTP request -> route + validation -> service -> Drizzle -> PostgreSQL
```

- `routes/` parses HTTP input, calls a service, and formats the response.
- `schemas/` owns reusable request validation.
- `services/` owns business rules, transactions, and database access.
- `db/` owns the database connection and table definitions.
- `middleware/` contains cross-cutting HTTP behavior such as authentication.

Do not add a repository layer for simple CRUD. Introduce one only when database
queries are complex or reused by several services.

## Frontend placement

Put business-specific UI in `features/<domain>/`, reusable application UI in
`components/shared/`, and shadcn/ui primitives in `components/ui/`.

```text
client/src/
├── api/
│   ├── client.ts
│   └── bookings.ts
├── components/
│   ├── shared/
│   │   └── PageHeader.tsx
│   └── ui/
│       └── button.tsx
├── features/
│   └── bookings/
│       ├── BookingForm.tsx
│       └── useBookings.ts
├── lib/
│   └── utils.ts
└── pages/
    └── BookingsPage.tsx
```

- `api/client.ts` owns the base URL, headers, JSON parsing, and common errors.
- `api/<domain>.ts` exposes typed API operations for one domain.
- `features/` contains UI and hooks used by one business feature.
- `components/ui/` contains shadcn/ui primitives added with the shadcn CLI.
- `components/shared/` composes primitives into UI used by multiple features.
- `lib/utils.ts` contains shadcn/ui's shared `cn()` class-name helper.
- `pages/` composes features into route-level screens.
- `types/` is only for types shared by multiple frontend domains. Keep local
  types next to the feature that uses them.

The render flow is:

```text
page -> feature/component -> domain API -> API client -> server
```

## Tests

Keep tests close to the code they cover and use the `.test.ts` or `.test.tsx`
suffix. Put end-to-end tests in a root `e2e/` directory if they are introduced.

## Generated and local files

- Commit generated migration files in `server/drizzle/`.
- Commit `.env.example` files with safe example values.
- Ignore `.env`, local PostgreSQL volumes/data, build output, coverage, and
  dependencies.
