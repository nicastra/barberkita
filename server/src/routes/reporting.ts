import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { requireAuth } from '../middleware/auth';
import {
  dashboardQuerySchema,
  reportRangeQuerySchema,
} from '../schemas/reporting';
import type { AuthService, AuthUser } from '../services/auth-service';
import {
  ReportingDomainError,
  type ReportingService,
} from '../services/reporting-service';

export function createReportingRoutes(
  authService: AuthService,
  reportingService: ReportingService,
) {
  const app = new Hono<{
    Variables: { user: AuthUser; sessionToken: string };
  }>();
  app.use('*', requireAuth(authService));
  app.onError((error, context) => {
    if (error instanceof ReportingDomainError)
      return context.json(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    throw error;
  });
  app.get(
    '/dashboard',
    zValidator('query', dashboardQuerySchema),
    async (context) =>
      context.json({
        dashboard: await reportingService.dashboard(
          context.get('user'),
          context.req.valid('query'),
        ),
      }),
  );
  app.get(
    '/revenue',
    zValidator('query', reportRangeQuerySchema),
    async (context) =>
      context.json({
        report: await reportingService.revenue(
          context.get('user'),
          context.req.valid('query'),
        ),
      }),
  );
  app.get(
    '/performance',
    zValidator('query', reportRangeQuerySchema),
    async (context) =>
      context.json({
        report: await reportingService.performance(
          context.get('user'),
          context.req.valid('query'),
        ),
      }),
  );
  return app;
}

export function createDashboardRoutes(
  authService: AuthService,
  reportingService: ReportingService,
) {
  const app = new Hono<{
    Variables: { user: AuthUser; sessionToken: string };
  }>();
  app.use('*', requireAuth(authService));
  app.onError((error, context) => {
    if (error instanceof ReportingDomainError)
      return context.json(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    throw error;
  });
  app.get('/', zValidator('query', dashboardQuerySchema), async (context) =>
    context.json({
      dashboard: await reportingService.dashboard(
        context.get('user'),
        context.req.valid('query'),
      ),
    }),
  );
  return app;
}
