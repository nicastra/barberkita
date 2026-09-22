# CukurPro Documentation

Project documentation is intentionally split by purpose:

- [Getting started](../README.md) explains local setup and workspace commands.
- [Project structure](project-structure.md) explains where code belongs.
- [Coding conventions](coding-conventions.md) explains how code should be written.
- [MVP roadmap](roadmap/README.md) records Phases 0 through 7 and the paused
  single-shop release gate.
- [SaaS roadmap](roadmap/saas/README.md) plans Phases 8 through 15 for
  multi-tenant organizations, branches, provider operations, and growth.
- [Security review](security-review.md) records controls and residual risks.
- [Tenant authorization contract](security/tenant-authorization.md) defines
  Phase 8 scope and error-code behavior.
- [Accessibility review](accessibility-review.md) defines the responsive and assistive-technology baseline.
- [Production operations](operations/production.md) covers deployment and migrations.
- [SaaS migration rehearsal](operations/saas-migration.md) documents the
  restartable Phase 9 tenant backfill and reconciliation checks.
- [Backup and restore](operations/backup-restore.md) defines recovery procedures.
- [Release checklist](release-checklist.md) is the final acceptance gate.

Keep `AGENTS.md` short. Put lasting architecture and coding guidance here instead
of adding large examples to the agent entry point.
