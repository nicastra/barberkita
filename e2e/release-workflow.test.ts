import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../server/src/app';
import { createDatabase } from '../server/src/db/client';
import { createAuthService } from '../server/src/services/auth-service';
import { createAvailabilityService } from '../server/src/services/availability-service';
import {
  createBookingReservationSource,
  createBookingService,
} from '../server/src/services/booking-service';
import { createCatalogService } from '../server/src/services/catalog-service';
import { createCheckoutService } from '../server/src/services/checkout-service';
import { createCustomerService } from '../server/src/services/customer-service';
import { createDatabaseHealthService } from '../server/src/services/database-health-service';
import { createHealthService } from '../server/src/services/health-service';
import { createReportingService } from '../server/src/services/reporting-service';
import { createShopService } from '../server/src/services/shop-service';
import { createTenantService } from '../server/src/services/tenant-service';
import { createInvitationService } from '../server/src/services/invitation-service';
import { createProviderOnboardingService } from '../server/src/services/provider-onboarding-service';
import { createProviderDashboardService } from '../server/src/services/provider-dashboard-service';
import { createOnboardingService } from '../server/src/services/onboarding-service';
import { createSupportAccessService } from '../server/src/services/support-access-service';
import { hashToken } from '../server/src/services/auth-service';
import {
  invitations,
  organizationSubscriptions,
  organizations,
  platformAdmins,
  shops,
  users,
} from '../server/src/db/schema';
import { eq, sql } from '../server/node_modules/drizzle-orm';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required.');

const connection = createDatabase(databaseUrl);
const database = connection.database;
const authService = createAuthService(database, {
  hash: async (value) => `e2e:${value}`,
  verify: async (value, hash) => hash === `e2e:${value}`,
});
const customerService = createCustomerService(database);
const reservationSource = createBookingReservationSource(database);
const availabilityService = createAvailabilityService(
  database,
  reservationSource,
);
const bookingService = createBookingService(
  database,
  availabilityService,
  customerService,
);
const app = createApp({
  allowedOrigins: ['https://staff.example.com'],
  healthService: createHealthService(createDatabaseHealthService(database)),
  authService,
  shopService: createShopService(database),
  catalogService: createCatalogService(database),
  availabilityService,
  customerService,
  bookingService,
  checkoutService: createCheckoutService(database),
  reportingService: createReportingService(database),
  tenantService: createTenantService(database),
  invitationService: createInvitationService(database, {
    hash: async (value) => `e2e:${value}`,
  }),
  providerOnboardingService: createProviderOnboardingService(database),
  providerDashboardService: createProviderDashboardService(database),
  onboardingService: createOnboardingService(database),
  supportAccessService: createSupportAccessService(database),
  secureCookies: true,
  // This fixture exercises the temporary compatibility surface as well as
  // the scoped routes; production keeps this opt-in disabled.
  enableLegacyRoutes: true,
});

let sessionToken = '';
let ownerSessionToken = '';
let ownerId = '';
let serviceId = '';
let barberId = '';
let bookingId = '';
let checkoutId = '';
let paymentId = '';
let bookingDate = '';
let organizationId = '';
let shopId = '';
let providerSessionToken = '';
let providerOrganizationId = '';
let providerShopId = '';
let providerOwnerToken = '';

function request(
  path: string,
  method = 'GET',
  body?: unknown,
  authenticated = true,
) {
  return app.request(path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(authenticated && sessionToken
        ? { Authorization: `Bearer ${sessionToken}` }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function requestAs(
  token: string,
  path: string,
  method = 'GET',
  body?: unknown,
) {
  return app.request(path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${token}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function responseJson(
  response: Response,
): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

beforeAll(async () => {
  const [provider] = await database
    .insert(users)
    .values({
      name: 'Acceptance Provider',
      email: 'acceptance-provider@release.test',
      passwordHash: 'e2e:ProviderPassword123!',
      active: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { active: true, passwordHash: 'e2e:ProviderPassword123!' },
    })
    .returning({ id: users.id });
  if (!provider) throw new Error('Could not seed acceptance provider.');
  await database
    .insert(platformAdmins)
    .values({ userId: provider.id })
    .onConflictDoNothing();
  const seededShop = await database
    .select({ id: shops.id })
    .from(shops)
    .limit(1)
    .then((rows) => rows[0]);
  if (!seededShop) throw new Error('Could not find seeded shop.');
  await database.execute(sql`
    insert into staff_users (id, user_id, shop_id, email, name, password_hash, role, active)
    values (${provider.id}, ${provider.id}, ${seededShop.id}, 'acceptance-provider@release.test', 'Acceptance Provider', 'e2e:ProviderPassword123!', 'staff', true)
    on conflict (id) do update set active = true, password_hash = excluded.password_hash
  `);
  const health = await request('/api/health', 'GET', undefined, false);
  expect(health.status).toBe(200);
});

afterAll(async () => {
  await connection.client.end();
});

describe('single-shop release workflow', () => {
  it('signs in the migrated owner and establishes a secure session', async () => {
    const signIn = await request(
      '/api/auth/sign-in',
      'POST',
      { email: 'owner@cukurpro.local', password: 'OwnerPassword123!' },
      false,
    );
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers.get('Set-Cookie') ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    sessionToken = cookie.match(/cukurpro_session=([^;]+)/)?.[1] ?? '';
    ownerSessionToken = sessionToken;
    expect(sessionToken.length).toBeGreaterThan(20);
    ownerId = ((await responseJson(signIn)).user as { id: string }).id;

    const memberships = await request('/api/shops');
    expect(memberships.status).toBe(200);
    const membership = (
      (await responseJson(memberships)).memberships as {
        organizationId: string;
        shopId: string;
      }[]
    )[0];
    organizationId = membership!.organizationId;
    shopId = membership!.shopId;

    const removeLastOwner = await request(
      `/api/auth/staff/${ownerId}`,
      'PATCH',
      { role: 'staff' },
    );
    expect(removeLastOwner.status).toBe(409);
    await expect(responseJson(removeLastOwner)).resolves.toMatchObject({
      error: { code: 'LAST_OWNER_REQUIRED' },
    });
    expect(
      (
        await request('/api/shop', 'PATCH', {
          address: 'Jl. Release No. 7, Jakarta',
        })
      ).status,
    ).toBe(200);
  });

  it('creates, accepts, and consumes a scoped invitation once', async () => {
    const wrongScope = await request(
      `/api/organizations/${organizationId}/invitations`,
      'POST',
      {
        shopId: crypto.randomUUID(),
        email: 'wrong-scope@release.test',
        organizationRole: 'organization_member',
        shopRole: 'receptionist',
        expiresInHours: 72,
      },
    );
    expect(wrongScope.status).toBe(403);

    const invitationResponse = await request(
      `/api/organizations/${organizationId}/invitations`,
      'POST',
      {
        shopId,
        email: 'invited@release.test',
        organizationRole: 'organization_member',
        shopRole: 'receptionist',
        expiresInHours: 72,
      },
    );
    expect(invitationResponse.status).toBe(201);
    const invitation = (await responseJson(invitationResponse)) as {
      token: string;
    };
    expect(invitation.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);

    const accepted = await request(
      `/api/invitations/${invitation.token}/accept`,
      'POST',
      { name: 'Invited Receptionist', password: 'InvitedPassword123!' },
      false,
    );
    expect(accepted.status).toBe(200);
    const reused = await request(
      `/api/invitations/${invitation.token}/accept`,
      'POST',
      { password: 'InvitedPassword123!' },
      false,
    );
    expect(reused.status).toBe(400);
    await expect(responseJson(reused)).resolves.toMatchObject({
      error: { code: 'INVITATION_UNAVAILABLE' },
    });

    const second = await request(
      `/api/organizations/${organizationId}/invitations`,
      'POST',
      {
        shopId,
        email: 'revoked@release.test',
        organizationRole: 'organization_member',
        shopRole: 'receptionist',
        expiresInHours: 72,
      },
    );
    expect(second.status).toBe(201);
    const secondPayload = (await responseJson(second)) as {
      token: string;
      invitation: { id: string; tokenHash?: string };
    };
    expect(secondPayload.invitation.tokenHash).toBeUndefined();
    const storedToken = await database
      .select({ tokenHash: invitations.tokenHash })
      .from(invitations)
      .where(eq(invitations.id, secondPayload.invitation.id))
      .limit(1);
    expect(storedToken[0]?.tokenHash).toBeDefined();
    expect(storedToken[0]?.tokenHash).not.toBe(secondPayload.token);
    const listed = await request(
      `/api/organizations/${organizationId}/invitations`,
    );
    expect(listed.status).toBe(200);
    expect(
      ((await responseJson(listed)).invitations as unknown[]).length,
    ).toBeGreaterThanOrEqual(2);
    const revoked = await request(
      `/api/organizations/${organizationId}/invitations/${secondPayload.invitation.id}/revoke`,
      'POST',
    );
    expect(revoked.status).toBe(204);
    const revokedAccept = await request(
      `/api/invitations/${secondPayload.token}/accept`,
      'POST',
      { password: 'RevokedPassword123!' },
      false,
    );
    expect(revokedAccept.status).toBe(400);

    const expiredToken = crypto.randomUUID().replaceAll('-', '') + 'expiredxx';
    await database.insert(invitations).values({
      organizationId,
      shopId,
      email: 'expired@release.test',
      organizationRole: 'organization_member',
      shopRole: 'receptionist',
      tokenHash: hashToken(expiredToken),
      expiresAt: new Date(Date.now() - 60_000),
      invitedByUserId: ownerId,
    });
    const expiredAccept = await request(
      `/api/invitations/${expiredToken}/accept`,
      'POST',
      { password: 'ExpiredPassword123!' },
      false,
    );
    expect(expiredAccept.status).toBe(400);

    const concurrent = await request(
      `/api/organizations/${organizationId}/invitations`,
      'POST',
      {
        shopId,
        email: 'concurrent@release.test',
        organizationRole: 'organization_member',
        shopRole: 'receptionist',
        expiresInHours: 72,
      },
    );
    const concurrentPayload = (await responseJson(concurrent)) as {
      token: string;
    };
    const concurrentResults = await Promise.all([
      request(
        `/api/invitations/${concurrentPayload.token}/accept`,
        'POST',
        { name: 'Concurrent One', password: 'ConcurrentPassword123!' },
        false,
      ),
      request(
        `/api/invitations/${concurrentPayload.token}/accept`,
        'POST',
        { name: 'Concurrent Two', password: 'ConcurrentPassword123!' },
        false,
      ),
    ]);
    expect(concurrentResults.map((result) => result.status).sort()).toEqual([
      200, 400,
    ]);
  });

  it('invalidates an invited session immediately when membership is removed', async () => {
    const invite = await request(
      `/api/organizations/${organizationId}/invitations`,
      'POST',
      {
        shopId,
        email: 'session-removal@release.test',
        organizationRole: 'organization_member',
        shopRole: 'receptionist',
        expiresInHours: 72,
      },
    );
    const invitePayload = (await responseJson(invite)) as { token: string };
    const accepted = await request(
      `/api/invitations/${invitePayload.token}/accept`,
      'POST',
      { name: 'Session Removal', password: 'SessionPassword123!' },
      false,
    );
    expect(accepted.status).toBe(200);
    const invitedSignIn = await request(
      '/api/auth/sign-in',
      'POST',
      {
        email: 'session-removal@release.test',
        password: 'SessionPassword123!',
      },
      false,
    );
    expect(invitedSignIn.status).toBe(200);
    const invitedToken =
      invitedSignIn.headers
        .get('Set-Cookie')
        ?.match(/cukurpro_session=([^;]+)/)?.[1] ?? '';
    const invitedUserId = (
      (await responseJson(invitedSignIn)).user as { id: string }
    ).id;
    expect(invitedToken).toHaveLength(43);

    const removal = await requestAs(
      ownerSessionToken,
      `/api/organizations/${organizationId}/memberships/${invitedUserId}`,
      'PATCH',
      { shopId, active: false },
    );
    expect(removal.status).toBe(200);
    expect((await requestAs(invitedToken, '/api/auth/me')).status).toBe(401);
  });

  it('keeps tenant identifiers and public slugs isolated', async () => {
    const forgedShop = crypto.randomUUID();
    const forged = await request(`/api/shops/${forgedShop}/services`);
    expect(forged.status).toBe(403);

    const wrongSlug = await request(
      '/api/public/shops/not-a-real-branch/options',
      'GET',
      undefined,
      false,
    );
    expect(wrongSlug.status).toBe(404);

    const crossShopAvailability = await request(
      `/api/shops/${shopId}/availability?serviceId=${crypto.randomUUID()}&date=2030-01-01`,
    );
    expect(crossShopAvailability.status).toBe(404);

    const rejectedSwitch = await request(
      `/api/auth/switch-shop/${forgedShop}`,
      'POST',
    );
    expect(rejectedSwitch.status).toBe(403);
  });

  it('configures a service, barber, and future availability', async () => {
    const serviceResponse = await request('/api/services', 'POST', {
      name: 'Release Haircut',
      description: 'Acceptance service',
      durationMinutes: 30,
      priceRupiah: 75_000,
      active: true,
    });
    expect(serviceResponse.status).toBe(201);
    serviceId = (
      (await responseJson(serviceResponse)).service as { id: string }
    ).id;

    const barberResponse = await request('/api/barbers', 'POST', {
      name: 'Release Barber',
      staffUserId: ownerId,
      active: true,
    });
    expect(barberResponse.status).toBe(201);
    barberId = ((await responseJson(barberResponse)).barber as { id: string })
      .id;
    expect(
      (
        await request(`/api/barbers/${barberId}/services`, 'PUT', {
          serviceIds: [serviceId],
        })
      ).status,
    ).toBe(200);

    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1_000);
    bookingDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(future);
    const dayOfWeek = new Date(`${bookingDate}T00:00:00.000Z`).getUTCDay();
    expect(
      (
        await request(`/api/barbers/${barberId}/working-hours`, 'PUT', {
          hours: [{ dayOfWeek, startTime: '09:00', endTime: '17:00' }],
        })
      ).status,
    ).toBe(200);
    const checklist = await request(`/api/shops/${shopId}/onboarding`);
    expect(checklist.status).toBe(200);
    expect(
      ((await responseJson(checklist)).checklist as { complete: boolean })
        .complete,
    ).toBe(true);
  });

  it('self-books publicly and exercises the operational lifecycle', async () => {
    const availabilityResponse = await request(
      `/api/public/availability?serviceId=${serviceId}&barberId=${barberId}&date=${bookingDate}`,
      'GET',
      undefined,
      false,
    );
    expect(availabilityResponse.status).toBe(200);
    const availability = (await responseJson(availabilityResponse))
      .availability as { slots: { startAt: string }[] };
    expect(availability.slots.length).toBeGreaterThan(0);
    const startAt = availability.slots[0]!.startAt;

    const bookingResponse = await request(
      '/api/public/bookings',
      'POST',
      {
        serviceId,
        barberId,
        startAt,
        customer: {
          name: 'Release Customer',
          phone: '+62 812 3456 7890',
          email: 'customer@release.test',
        },
      },
      false,
    );
    expect(bookingResponse.status).toBe(201);
    bookingId = (
      (await responseJson(bookingResponse)).booking as { id: string }
    ).id;
    const conflict = await request(
      '/api/public/bookings',
      'POST',
      {
        serviceId,
        barberId,
        startAt,
        customer: {
          name: 'Second Customer',
          phone: '+62 812 0000 0000',
          email: null,
        },
      },
      false,
    );
    expect(conflict.status).toBe(409);

    const customerResponse = await request('/api/customers', 'POST', {
      name: 'Staff-booked Customer',
      phone: '+62 812 1111 2222',
      email: null,
      notes: 'Release staff booking',
    });
    expect(customerResponse.status).toBe(201);
    const customerId = (
      (await responseJson(customerResponse)).customer as { id: string }
    ).id;
    const remainingAvailability = await request(
      `/api/public/availability?serviceId=${serviceId}&barberId=${barberId}&date=${bookingDate}`,
      'GET',
      undefined,
      false,
    );
    const staffStartAt = (
      (await responseJson(remainingAvailability)).availability as {
        slots: { startAt: string }[];
      }
    ).slots[0]!.startAt;
    const staffBooking = await request('/api/bookings', 'POST', {
      customerId,
      serviceId,
      barberId,
      startAt: staffStartAt,
      notes: 'Created by staff',
    });
    expect(staffBooking.status).toBe(201);
    const staffBookingId = (
      (await responseJson(staffBooking)).booking as { id: string }
    ).id;
    expect(
      (await request(`/api/bookings/${staffBookingId}/cancel`, 'POST')).status,
    ).toBe(200);

    for (const action of ['confirm', 'check-in', 'start', 'complete']) {
      const transition = await request(
        `/api/bookings/${bookingId}/${action}`,
        'POST',
      );
      expect(transition.status).toBe(200);
    }
  });

  it('checks out, retries payment idempotently, and applies a correction', async () => {
    const checkoutResponse = await request('/api/checkouts', 'POST', {
      bookingId,
      discountRupiah: 0,
      adjustmentReason: '',
    });
    expect(checkoutResponse.status).toBe(201);
    checkoutId = (
      (await responseJson(checkoutResponse)).checkout as { id: string }
    ).id;
    const idempotencyKey = crypto.randomUUID();
    const paymentBody = {
      amountRupiah: 75_000,
      method: 'cash',
      reference: '',
      idempotencyKey,
    };
    const paymentResponse = await request(
      `/api/checkouts/${checkoutId}/payments`,
      'POST',
      paymentBody,
    );
    expect(paymentResponse.status).toBe(200);
    const paidCheckout = (await responseJson(paymentResponse)).checkout as {
      payments: { id: string }[];
      paidRupiah: number;
    };
    paymentId = paidCheckout.payments[0]!.id;
    expect(paidCheckout.paidRupiah).toBe(75_000);
    const retry = await request(
      `/api/checkouts/${checkoutId}/payments`,
      'POST',
      paymentBody,
    );
    expect(retry.status).toBe(200);
    expect(
      ((await responseJson(retry)).checkout as { payments: unknown[] })
        .payments,
    ).toHaveLength(1);

    const correction = await request(
      `/api/checkouts/${checkoutId}/payments/${paymentId}/corrections`,
      'POST',
      {
        kind: 'refund',
        amountRupiah: 10_000,
        reason: 'Release correction',
        idempotencyKey: crypto.randomUUID(),
      },
    );
    expect(correction.status).toBe(200);
    expect(
      ((await responseJson(correction)).checkout as { paidRupiah: number })
        .paidRupiah,
    ).toBe(65_000);
  });

  it('reconciles dashboard, revenue, and performance reports', async () => {
    const dashboard = await request(`/api/dashboard?date=${bookingDate}`);
    expect(dashboard.status).toBe(200);
    expect(
      (
        (await responseJson(dashboard)).dashboard as {
          totals: { completed: number };
        }
      ).totals.completed,
    ).toBe(1);
    expect(
      (
        (
          await responseJson(
            await request(`/api/dashboard?date=${bookingDate}`),
          )
        ).dashboard as { totals: { cancelled: number } }
      ).totals.cancelled,
    ).toBe(1);

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const revenue = await request(
      `/api/reports/revenue?from=${today}&to=${today}`,
    );
    expect(
      ((await responseJson(revenue)).report as { netRupiah: number }).netRupiah,
    ).toBe(65_000);
    const performance = await request(
      `/api/reports/performance?from=${bookingDate}&to=${bookingDate}`,
    );
    const report = (await responseJson(performance)).report as {
      staff: { attributedRevenueRupiah: number }[];
      services: { completionCount: number }[];
    };
    expect(report.staff[0]?.attributedRevenueRupiah).toBe(65_000);
    expect(report.services[0]?.completionCount).toBe(1);
  });

  it('makes suspended organizations read-only and closes public booking', async () => {
    await database
      .update(organizations)
      .set({ lifecycle: 'suspended' })
      .where(eq(organizations.id, organizationId));
    const read = await request(`/api/shops/${shopId}/services`);
    expect(read.status).toBe(200);
    const write = await request(`/api/shops/${shopId}/services`, 'POST', {
      name: 'Blocked Service',
      description: '',
      durationMinutes: 30,
      priceRupiah: 1,
      active: true,
    });
    expect(write.status).toBe(403);
    await expect(responseJson(write)).resolves.toMatchObject({
      error: { code: 'ORGANIZATION_SUSPENDED' },
    });
    const legacyWrite = await request('/api/services', 'POST', {
      name: 'Legacy Blocked Service',
      description: '',
      durationMinutes: 30,
      priceRupiah: 1,
      active: true,
    });
    expect(legacyWrite.status).toBe(403);
    const publicOptions = await request(
      `/api/public/shops/cukurpro-demo-shop/options`,
      'GET',
      undefined,
      false,
    );
    expect(publicOptions.status).toBe(404);
    const publicBooking = await request(
      '/api/public/bookings',
      'POST',
      {
        serviceId,
        barberId,
        startAt: new Date(Date.now() + 86_400_000).toISOString(),
        customer: {
          name: 'Suspended Customer',
          phone: '+628123456789',
          email: null,
        },
      },
      false,
    );
    expect(publicBooking.status).toBe(400);
    await database
      .update(organizations)
      .set({ lifecycle: 'active' })
      .where(eq(organizations.id, organizationId));
  });

  it('covers provider authorization, onboarding, lifecycle sync, and archive isolation', async () => {
    const denied = await request('/api/provider/dashboard');
    expect(denied.status).toBe(403);

    const providerSignIn = await request(
      '/api/auth/sign-in',
      'POST',
      {
        email: 'acceptance-provider@release.test',
        password: 'ProviderPassword123!',
      },
      false,
    );
    expect(providerSignIn.status).toBe(200);
    providerSessionToken =
      providerSignIn.headers
        .get('Set-Cookie')
        ?.match(/cukurpro_session=([^;]+)/)?.[1] ?? '';
    expect(providerSessionToken).toHaveLength(43);

    const created = await requestAs(
      providerSessionToken,
      '/api/provider/organizations',
      'POST',
      {
        organization: {
          name: 'Acceptance Pilot',
          slug: 'acceptance-pilot',
          lifecycle: 'trialing',
        },
        shop: {
          name: 'Acceptance Pilot Branch',
          slug: 'acceptance-pilot-branch',
          phone: '+62 21 555 0199',
          email: 'acceptance-pilot@release.test',
          address: 'Jl. Acceptance No. 1, Jakarta',
          timezone: 'Asia/Jakarta',
        },
        owner: {
          email: 'acceptance-pilot-owner@release.test',
          expiresInHours: 72,
        },
      },
    );
    expect(created.status).toBe(201);
    const createdPayload = (await responseJson(created)) as {
      organization: { id: string };
      shop: { id: string };
      token: string;
    };
    providerOrganizationId = createdPayload.organization.id;
    providerShopId = createdPayload.shop.id;
    expect(createdPayload.token.length).toBeGreaterThan(40);

    const accepted = await request(
      `/api/invitations/${createdPayload.token}/accept`,
      'POST',
      { name: 'Acceptance Pilot Owner', password: 'PilotOwnerPassword123!' },
      false,
    );
    expect(accepted.status).toBe(200);
    const suspended = await requestAs(
      providerSessionToken,
      `/api/provider/organizations/${providerOrganizationId}/lifecycle`,
      'PATCH',
      { lifecycle: 'suspended', reason: 'Acceptance suspension' },
    );
    expect(suspended.status).toBe(200);
    const subscription = await database
      .select({ status: organizationSubscriptions.status })
      .from(organizationSubscriptions)
      .where(
        eq(organizationSubscriptions.organizationId, providerOrganizationId),
      )
      .limit(1);
    expect(subscription[0]?.status).toBe('suspended');

    const archived = await requestAs(
      providerSessionToken,
      `/api/provider/organizations/${providerOrganizationId}/lifecycle`,
      'PATCH',
      { lifecycle: 'archived', reason: 'Acceptance archive' },
    );
    expect(archived.status).toBe(200);
    const ownerSignIn = await request(
      '/api/auth/sign-in',
      'POST',
      {
        email: 'acceptance-pilot-owner@release.test',
        password: 'PilotOwnerPassword123!',
      },
      false,
    );
    expect(ownerSignIn.status).toBe(200);
    providerOwnerToken =
      ownerSignIn.headers
        .get('Set-Cookie')
        ?.match(/cukurpro_session=([^;]+)/)?.[1] ?? '';
    expect(
      (
        await requestAs(
          providerOwnerToken,
          `/api/shops/${providerShopId}/services`,
        )
      ).status,
    ).toBe(403);

    const providerDashboard = await requestAs(
      providerSessionToken,
      '/api/provider/dashboard',
    );
    expect(providerDashboard.status).toBe(200);
    const serialized = JSON.stringify(await responseJson(providerDashboard));
    for (const forbiddenField of [
      'customer',
      'booking',
      'payment',
      'revenue',
      'performance',
    ])
      expect(serialized.toLowerCase()).not.toContain(forbiddenField);

    // Keep the migration rehearsal representative of the pre-SaaS single-shop
    // installation; this provider fixture is fully exercised above and then
    // removed before the one-time migration step runs.
    await database.execute(
      sql`delete from tenant_audit_logs where organization_id = ${providerOrganizationId}`,
    );
    await database.execute(
      sql`delete from onboarding_milestones where organization_id = ${providerOrganizationId}`,
    );
    await database.execute(
      sql`delete from invitations where organization_id = ${providerOrganizationId}`,
    );
    await database.execute(
      sql`delete from shop_memberships where organization_id = ${providerOrganizationId}`,
    );
    await database.execute(
      sql`delete from organization_memberships where organization_id = ${providerOrganizationId}`,
    );
    await database.execute(
      sql`delete from organization_subscriptions where organization_id = ${providerOrganizationId}`,
    );
    await database.execute(
      sql`delete from staff_users where shop_id in (select id from shops where organization_id = ${providerOrganizationId})`,
    );
    await database.execute(
      sql`delete from shops where organization_id = ${providerOrganizationId}`,
    );
    await database.execute(
      sql`delete from organizations where id = ${providerOrganizationId}`,
    );
  });
});
