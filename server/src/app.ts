import { cors } from 'hono/cors';
import { Hono } from 'hono';
import { logger } from 'hono/logger';

import { createHealthRoutes } from './routes/health';
import { createAuthRoutes } from './routes/auth';
import { createShopRoutes } from './routes/shop';
import type { AuthService } from './services/auth-service';
import type { HealthService } from './services/health-service';
import type { ShopService } from './services/shop-service';

export interface AppDependencies {
  allowedOrigins: string[];
  healthService: HealthService;
  authService?: AuthService;
  shopService?: ShopService;
}

export function createApp({
  allowedOrigins,
  healthService,
  authService,
  shopService,
}: AppDependencies): Hono {
  const app = new Hono();

  app.use('*', logger());
  app.use(
    '/api/*',
    cors({
      origin: (origin) => (allowedOrigins.includes(origin) ? origin : ''),
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  );

  app.route('/api/health', createHealthRoutes(healthService));
  if (authService) app.route('/api/auth', createAuthRoutes(authService));
  if (authService && shopService)
    app.route('/api/shop', createShopRoutes(authService, shopService));

  app.notFound((context) =>
    context.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource was not found.',
        },
      },
      404,
    ),
  );

  app.onError((error, context) => {
    console.error('Unexpected request failure', error);
    return context.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred.',
        },
      },
      500,
    );
  });

  return app;
}
