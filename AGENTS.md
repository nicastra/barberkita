# CukurPro Agent Guide

CukurPro is a barbershop-management MVP built with Bun, Hono, Drizzle,
PostgreSQL, React, Vite, Tailwind CSS, shadcn/ui, and Zod.

Before changing code, follow:

- [Project structure](docs/project-structure.md)
- [Coding conventions](docs/coding-conventions.md)

## Core rules

- Keep TypeScript strict and do not use `any`.
- Validate every external input with Zod and `@hono/zod-validator`.
- Keep HTTP route handlers thin; put business logic in server services.
- Use Drizzle instead of raw SQL and use `.returning()` for writes.
- Keep frontend API calls in the centralized API layer.
- Build frontend UI with shadcn/ui primitives and Tailwind CSS utilities.
- Use environment variables for URLs, ports, and database credentials.
- Never commit `.env` files or database credentials.
- Make the smallest change that fully solves the task.
- Run the relevant checks before considering work complete.

If documentation and implementation disagree, update both in the same change.
