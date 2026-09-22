import { createApp } from './app';
import { parseConfig } from './config';
import { createDatabase } from './db/client';
import { createDatabaseHealthService } from './services/database-health-service';
import { createHealthService } from './services/health-service';
import { createAuthService } from './services/auth-service';
import { createAvailabilityService } from './services/availability-service';
import {
  createBookingReservationSource,
  createBookingService,
} from './services/booking-service';
import { createCatalogService } from './services/catalog-service';
import { createCustomerService } from './services/customer-service';
import { createShopService } from './services/shop-service';
import { createCheckoutService } from './services/checkout-service';
import { createReportingService } from './services/reporting-service';
import { createTenantService } from './services/tenant-service';
import { createInvitationService } from './services/invitation-service';
import { createProviderOnboardingService } from './services/provider-onboarding-service';
import { createProviderDashboardService } from './services/provider-dashboard-service';
import { createOnboardingService } from './services/onboarding-service';
import { createSupportAccessService } from './services/support-access-service';

const config = parseConfig(process.env);
const { database } = createDatabase(config.databaseUrl);
const databaseHealthService = createDatabaseHealthService(database);
const healthService = createHealthService(databaseHealthService);
const authService = createAuthService(database);
const shopService = createShopService(database);
const catalogService = createCatalogService(database);
const reservationSource = createBookingReservationSource(database);
const availabilityService = createAvailabilityService(
  database,
  reservationSource,
);
const customerService = createCustomerService(database);
const bookingService = createBookingService(
  database,
  availabilityService,
  customerService,
);
const checkoutService = createCheckoutService(database);
const reportingService = createReportingService(database);
const tenantService = createTenantService(database);
const invitationService = createInvitationService(database);
const providerOnboardingService = createProviderOnboardingService(database);
const providerDashboardService = createProviderDashboardService(database);
const onboardingService = createOnboardingService(database);
const supportAccessService = createSupportAccessService(database);
const app = createApp({
  allowedOrigins: config.allowedOrigins,
  healthService,
  authService,
  shopService,
  catalogService,
  availabilityService,
  customerService,
  bookingService,
  checkoutService,
  reportingService,
  tenantService,
  invitationService,
  providerOnboardingService,
  providerDashboardService,
  onboardingService,
  supportAccessService,
  secureCookies: config.production,
  enableRequestLogging: config.production,
  authRateLimit: config.authRateLimit,
  publicRateLimit: config.publicRateLimit,
  rateLimitWindowMs: config.rateLimitWindowMs,
  maxRequestBodyBytes: config.maxRequestBodyBytes,
  enableLegacyRoutes: false,
});

const server = Bun.serve({
  port: config.port,
  fetch: app.fetch,
});

console.log(`CukurPro API listening on ${server.url}`);
