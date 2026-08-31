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
  secureCookies: true,
});

let sessionToken = '';
let ownerId = '';
let serviceId = '';
let barberId = '';
let bookingId = '';
let checkoutId = '';
let paymentId = '';
let bookingDate = '';

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

async function responseJson(
  response: Response,
): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

beforeAll(async () => {
  const health = await request('/api/health', 'GET', undefined, false);
  expect(health.status).toBe(200);
});

afterAll(async () => {
  await connection.client.end();
});

describe('single-shop release workflow', () => {
  it('sets up one owner and establishes a secure session', async () => {
    const setup = await request(
      '/api/auth/setup',
      'POST',
      {
        name: 'Release Owner',
        email: 'owner@release.test',
        password: 'ReleasePassword123!',
        shop: {
          name: 'Release Shop',
          phone: '+62 21 555 0199',
          email: 'shop@release.test',
          address: 'Jakarta',
          timezone: 'Asia/Jakarta',
        },
      },
      false,
    );
    expect(setup.status).toBe(201);
    const setupBody = await responseJson(setup);
    ownerId = (setupBody.user as { id: string }).id;
    expect((await request('/api/auth/setup', 'POST', {}, false)).status).toBe(
      400,
    );

    const signIn = await request(
      '/api/auth/sign-in',
      'POST',
      { email: 'owner@release.test', password: 'ReleasePassword123!' },
      false,
    );
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers.get('Set-Cookie') ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    sessionToken = cookie.match(/cukurpro_session=([^;]+)/)?.[1] ?? '';
    expect(sessionToken.length).toBeGreaterThan(20);

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
});
