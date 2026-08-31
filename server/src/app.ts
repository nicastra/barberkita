import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

import { createHealthRoutes } from './routes/health';
import { createAuthRoutes } from './routes/auth';
import { createAvailabilityRoutes } from './routes/availability';
import { createBarberRoutes, createServiceRoutes } from './routes/catalog';
import { createBookingRoutes } from './routes/bookings';
import { createCustomerRoutes } from './routes/customers';
import { createPublicBookingRoutes } from './routes/public-bookings';
import { createShopRoutes } from './routes/shop';
import { createCheckoutRoutes } from './routes/checkouts';
import {
  createDashboardRoutes,
  createReportingRoutes,
} from './routes/reporting';
import type { AuthService } from './services/auth-service';
import type { AvailabilityService } from './services/availability-service';
import type { CatalogService } from './services/catalog-service';
import type { BookingService } from './services/booking-service';
import type { CustomerService } from './services/customer-service';
import type { HealthService } from './services/health-service';
import type { ShopService } from './services/shop-service';
import type { CheckoutService } from './services/checkout-service';
import type { ReportingService } from './services/reporting-service';
import { createRateLimitMiddleware } from './middleware/rate-limit';
import { createRequestLogger } from './middleware/request-logger';

export interface AppDependencies {
  allowedOrigins: string[];
  healthService: HealthService;
  authService?: AuthService;
  shopService?: ShopService;
  catalogService?: CatalogService;
  availabilityService?: AvailabilityService;
  customerService?: CustomerService;
  bookingService?: BookingService;
  checkoutService?: CheckoutService;
  reportingService?: ReportingService;
  secureCookies?: boolean;
  enableRequestLogging?: boolean;
  authRateLimit?: number;
  publicRateLimit?: number;
  rateLimitWindowMs?: number;
  maxRequestBodyBytes?: number;
}

export function createApp({
  allowedOrigins,
  healthService,
  authService,
  shopService,
  catalogService,
  availabilityService,
  customerService,
  bookingService,
  checkoutService,
  reportingService,
  secureCookies = false,
  enableRequestLogging = false,
  authRateLimit = 10,
  publicRateLimit = 60,
  rateLimitWindowMs = 60_000,
  maxRequestBodyBytes = 262_144,
}: AppDependencies): Hono {
  const app = new Hono();

  app.use('*', secureHeaders());
  if (enableRequestLogging) app.use('*', createRequestLogger());
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: maxRequestBodyBytes,
      onError: (context) =>
        context.json(
          {
            error: {
              code: 'REQUEST_TOO_LARGE',
              message: 'The request body is too large.',
            },
          },
          413,
        ),
    }),
  );
  app.use(
    '/api/*',
    cors({
      origin: (origin) => (allowedOrigins.includes(origin) ? origin : ''),
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  );

  app.use(
    '/api/auth/sign-in',
    createRateLimitMiddleware({
      limit: authRateLimit,
      windowMs: rateLimitWindowMs,
    }),
  );
  app.use(
    '/api/auth/setup',
    createRateLimitMiddleware({
      limit: authRateLimit,
      windowMs: rateLimitWindowMs,
    }),
  );
  app.use(
    '/api/public/*',
    createRateLimitMiddleware({
      limit: publicRateLimit,
      windowMs: rateLimitWindowMs,
    }),
  );

  app.route('/api/health', createHealthRoutes(healthService));
  if (authService)
    app.route('/api/auth', createAuthRoutes(authService, secureCookies));
  if (authService && shopService)
    app.route('/api/shop', createShopRoutes(authService, shopService));
  if (authService && catalogService) {
    app.route(
      '/api/services',
      createServiceRoutes(authService, catalogService),
    );
    app.route('/api/barbers', createBarberRoutes(authService, catalogService));
  }
  if (authService && availabilityService)
    app.route(
      '/api/availability',
      createAvailabilityRoutes(authService, availabilityService),
    );
  if (authService && customerService)
    app.route(
      '/api/customers',
      createCustomerRoutes(authService, customerService),
    );
  if (authService && bookingService)
    app.route(
      '/api/bookings',
      createBookingRoutes(authService, bookingService),
    );
  if (bookingService)
    app.route('/api/public', createPublicBookingRoutes(bookingService));
  if (authService && checkoutService)
    app.route(
      '/api/checkouts',
      createCheckoutRoutes(authService, checkoutService),
    );
  if (authService && reportingService)
    app.route(
      '/api/reports',
      createReportingRoutes(authService, reportingService),
    );
  if (authService && reportingService)
    app.route(
      '/api/dashboard',
      createDashboardRoutes(authService, reportingService),
    );

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
