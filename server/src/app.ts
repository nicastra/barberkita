import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { zValidator } from '@hono/zod-validator';

import { createHealthRoutes } from './routes/health';
import { createAuthRoutes } from './routes/auth';
import { createAvailabilityRoutes } from './routes/availability';
import { createBarberRoutes, createServiceRoutes } from './routes/catalog';
import { createBookingRoutes } from './routes/bookings';
import { createCustomerRoutes } from './routes/customers';
import {
  createPublicBookingRoutes,
  createScopedPublicBookingRoutes,
} from './routes/public-bookings';
import { createShopRoutes } from './routes/shop';
import { createTenantRoutes } from './routes/tenant';
import { createOrganizationRoutes } from './routes/organizations';
import { createProviderRoutes } from './routes/provider';
import { createInvitationRoutes } from './routes/invitations';
import { createOnboardingRoutes } from './routes/onboarding';
import { tenantShopParamsSchema } from './schemas/tenant';
import { requireAuth, type AuthVariables } from './middleware/auth';
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
import type { TenantService } from './services/tenant-service';
import type { InvitationService } from './services/invitation-service';
import type { CheckoutService } from './services/checkout-service';
import type { ReportingService } from './services/reporting-service';
import type { ProviderOnboardingService } from './services/provider-onboarding-service';
import type { ProviderDashboardService } from './services/provider-dashboard-service';
import type { OnboardingService } from './services/onboarding-service';
import type { SupportAccessService } from './services/support-access-service';
import {
  requireLegacyTenantContext,
  requireTenantContext,
} from './middleware/tenant';
import { createRateLimitMiddleware } from './middleware/rate-limit';
import { createRequestLogger } from './middleware/request-logger';
import {
  createStaffSchema,
  staffIdSchema,
  updateStaffSchema,
} from './schemas/auth';

export interface AppDependencies {
  allowedOrigins: string[];
  healthService: HealthService;
  authService?: AuthService;
  shopService?: ShopService;
  tenantService?: TenantService;
  invitationService?: InvitationService;
  catalogService?: CatalogService;
  availabilityService?: AvailabilityService;
  customerService?: CustomerService;
  bookingService?: BookingService;
  checkoutService?: CheckoutService;
  reportingService?: ReportingService;
  providerOnboardingService?: ProviderOnboardingService;
  providerDashboardService?: ProviderDashboardService;
  onboardingService?: OnboardingService;
  supportAccessService?: SupportAccessService;
  secureCookies?: boolean;
  enableRequestLogging?: boolean;
  authRateLimit?: number;
  publicRateLimit?: number;
  rateLimitWindowMs?: number;
  maxRequestBodyBytes?: number;
  enableLegacyRoutes?: boolean;
}

export function createApp({
  allowedOrigins,
  healthService,
  authService,
  shopService,
  tenantService,
  invitationService,
  catalogService,
  availabilityService,
  customerService,
  bookingService,
  checkoutService,
  reportingService,
  providerOnboardingService,
  providerDashboardService,
  onboardingService,
  supportAccessService,
  // Legacy unscoped routes are opt-in for migration rehearsals only. The
  // production entry point and all new callers use tenant-scoped namespaces.
  enableLegacyRoutes = false,
  secureCookies = false,
  enableRequestLogging = false,
  authRateLimit = 10,
  publicRateLimit = 60,
  rateLimitWindowMs = 60_000,
  maxRequestBodyBytes = 262_144,
}: AppDependencies): Hono<{ Variables: AuthVariables }> {
  const app = new Hono<{ Variables: AuthVariables }>();

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
    '/api/public/*',
    createRateLimitMiddleware({
      limit: publicRateLimit,
      windowMs: rateLimitWindowMs,
    }),
  );
  app.use(
    '/api/invitations/*',
    createRateLimitMiddleware({
      limit: publicRateLimit,
      windowMs: rateLimitWindowMs,
    }),
  );

  app.route('/api/health', createHealthRoutes(healthService));
  const protectLegacyPath = (path: string) => {
    if (!enableLegacyRoutes || !authService || !tenantService) return;
    const scope = () =>
      [
        requireAuth(authService),
        requireLegacyTenantContext(tenantService),
      ] as const;
    app.use(path, ...scope());
    app.use(`${path}/*`, ...scope());
  };
  if (enableLegacyRoutes && authService && tenantService)
    protectLegacyPath('/api/auth/staff');
  if (authService)
    app.route(
      '/api/auth',
      createAuthRoutes(authService, secureCookies, enableLegacyRoutes),
    );
  if (enableLegacyRoutes && authService && shopService) {
    protectLegacyPath('/api/shop');
    app.route('/api/shop', createShopRoutes(authService, shopService));
  }
  if (authService && tenantService)
    app.route('/api/shops', createTenantRoutes(authService, tenantService));
  if (authService && tenantService)
    app.route(
      '/api/organizations',
      createOrganizationRoutes(
        authService,
        tenantService,
        invitationService,
        supportAccessService,
      ),
    );
  if (authService && tenantService)
    app.route(
      '/api/provider',
      createProviderRoutes(
        authService,
        tenantService,
        providerOnboardingService,
        providerDashboardService,
        supportAccessService,
      ),
    );
  if (authService && tenantService) {
    const scope = () =>
      [
        requireAuth(authService),
        zValidator('param', tenantShopParamsSchema),
        requireTenantContext(tenantService),
      ] as const;
    const protectShopPath = (path: string) => {
      app.use(path, ...scope());
      app.use(`${path}/*`, ...scope());
    };
    if (authService) {
      protectShopPath('/api/shops/:shopId/staff');
      app.get('/api/shops/:shopId/staff', async (context) => {
        const user = context.get('user');
        if (user.role !== 'owner')
          return context.json(
            {
              error: {
                code: 'TENANT_ROLE_FORBIDDEN',
                message: 'Owner access is required.',
              },
            },
            403,
          );
        return context.json({ staff: await authService.listStaff(user) });
      });
      app.post(
        '/api/shops/:shopId/staff',
        zValidator('json', createStaffSchema),
        async (context) => {
          const user = context.get('user');
          if (user.role !== 'owner')
            return context.json(
              {
                error: {
                  code: 'TENANT_ROLE_FORBIDDEN',
                  message: 'Owner access is required.',
                },
              },
              403,
            );
          return context.json(
            {
              staff: await authService.createStaff(
                user,
                context.req.valid('json'),
              ),
            },
            201,
          );
        },
      );
      app.patch(
        '/api/shops/:shopId/staff/:id',
        zValidator('param', tenantShopParamsSchema.merge(staffIdSchema)),
        zValidator('json', updateStaffSchema),
        async (context) => {
          const user = context.get('user');
          if (user.role !== 'owner')
            return context.json(
              {
                error: {
                  code: 'TENANT_ROLE_FORBIDDEN',
                  message: 'Owner access is required.',
                },
              },
              403,
            );
          const staff = await authService.updateStaff(
            user,
            context.req.valid('param').id,
            context.req.valid('json'),
          );
          return staff
            ? context.json({ staff })
            : context.json(
                {
                  error: {
                    code: 'NOT_FOUND',
                    message: 'Staff member not found.',
                  },
                },
                404,
              );
        },
      );
      app.delete(
        '/api/shops/:shopId/staff/:id',
        zValidator('param', tenantShopParamsSchema.merge(staffIdSchema)),
        async (context) => {
          const user = context.get('user');
          if (user.role !== 'owner')
            return context.json(
              {
                error: {
                  code: 'TENANT_ROLE_FORBIDDEN',
                  message: 'Owner access is required.',
                },
              },
              403,
            );
          const deleted = await authService.deleteStaff(
            user,
            context.req.valid('param').id,
          );
          return deleted
            ? context.body(null, 204)
            : context.json(
                {
                  error: {
                    code: 'NOT_FOUND',
                    message: 'Staff member not found.',
                  },
                },
                404,
              );
        },
      );
    }
    if (shopService) {
      protectShopPath('/api/shops/:shopId');
      app.route(
        '/api/shops/:shopId',
        createShopRoutes(authService, shopService),
      );
    }
    if (catalogService) {
      protectShopPath('/api/shops/:shopId/services');
      app.route(
        '/api/shops/:shopId/services',
        createServiceRoutes(authService, catalogService),
      );
      protectShopPath('/api/shops/:shopId/barbers');
      app.route(
        '/api/shops/:shopId/barbers',
        createBarberRoutes(authService, catalogService),
      );
    }
    if (availabilityService) {
      protectShopPath('/api/shops/:shopId/availability');
      app.route(
        '/api/shops/:shopId/availability',
        createAvailabilityRoutes(authService, availabilityService),
      );
    }
    if (customerService) {
      protectShopPath('/api/shops/:shopId/customers');
      app.route(
        '/api/shops/:shopId/customers',
        createCustomerRoutes(authService, customerService),
      );
    }
    if (bookingService) {
      protectShopPath('/api/shops/:shopId/bookings');
      app.route(
        '/api/shops/:shopId/bookings',
        createBookingRoutes(authService, bookingService),
      );
    }
    if (checkoutService) {
      protectShopPath('/api/shops/:shopId/checkouts');
      app.route(
        '/api/shops/:shopId/checkouts',
        createCheckoutRoutes(authService, checkoutService),
      );
    }
    if (reportingService) {
      protectShopPath('/api/shops/:shopId/reports');
      app.route(
        '/api/shops/:shopId/reports',
        createReportingRoutes(authService, reportingService),
      );
      protectShopPath('/api/shops/:shopId/dashboard');
      app.route(
        '/api/shops/:shopId/dashboard',
        createDashboardRoutes(authService, reportingService),
      );
    }
    if (onboardingService) {
      protectShopPath('/api/shops/:shopId/onboarding');
      app.route(
        '/api/shops/:shopId/onboarding',
        createOnboardingRoutes(authService, tenantService, onboardingService),
      );
    }
  }
  if (invitationService)
    app.route('/api/invitations', createInvitationRoutes(invitationService));
  if (enableLegacyRoutes && authService && catalogService) {
    protectLegacyPath('/api/services');
    protectLegacyPath('/api/barbers');
    app.route(
      '/api/services',
      createServiceRoutes(authService, catalogService),
    );
    app.route('/api/barbers', createBarberRoutes(authService, catalogService));
  }
  if (enableLegacyRoutes && authService && availabilityService) {
    protectLegacyPath('/api/availability');
    app.route(
      '/api/availability',
      createAvailabilityRoutes(authService, availabilityService),
    );
  }
  if (enableLegacyRoutes && authService && customerService) {
    protectLegacyPath('/api/customers');
    app.route(
      '/api/customers',
      createCustomerRoutes(authService, customerService),
    );
  }
  if (enableLegacyRoutes && authService && bookingService) {
    protectLegacyPath('/api/bookings');
    app.route(
      '/api/bookings',
      createBookingRoutes(authService, bookingService),
    );
  }
  if (enableLegacyRoutes && bookingService)
    app.route('/api/public', createPublicBookingRoutes(bookingService));
  if (bookingService)
    app.route(
      '/api/public/shops/:shopSlug',
      createScopedPublicBookingRoutes(bookingService),
    );
  if (enableLegacyRoutes && authService && checkoutService) {
    protectLegacyPath('/api/checkouts');
    app.route(
      '/api/checkouts',
      createCheckoutRoutes(authService, checkoutService),
    );
  }
  if (enableLegacyRoutes && authService && reportingService) {
    protectLegacyPath('/api/reports');
    app.route(
      '/api/reports',
      createReportingRoutes(authService, reportingService),
    );
    protectLegacyPath('/api/dashboard');
    app.route(
      '/api/dashboard',
      createDashboardRoutes(authService, reportingService),
    );
  }

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
