import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { createApp } from '../app';
import type { AuthService, AuthUser } from '../services/auth-service';
import {
  BookingDomainError,
  hasDatabaseCode,
  type BookingService,
  type BookingView,
} from '../services/booking-service';

const owner: AuthUser = {
  id: '00000000-0000-4000-8000-000000000001',
  shopId: '00000000-0000-4000-8000-000000000002',
  name: 'Owner',
  email: 'owner@example.com',
  role: 'owner',
};

const booking: BookingView = {
  id: '00000000-0000-4000-8000-000000000020',
  shopId: owner.shopId,
  customerId: '00000000-0000-4000-8000-000000000021',
  serviceId: '00000000-0000-4000-8000-000000000022',
  barberId: '00000000-0000-4000-8000-000000000023',
  createdByStaffUserId: owner.id,
  startAt: new Date('2026-09-02T02:00:00.000Z'),
  endAt: new Date('2026-09-02T02:30:00.000Z'),
  status: 'initial',
  source: 'staff',
  confirmationCode: 'CONFIRM123',
  notes: '',
  checkedInAt: null,
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  noShowAt: null,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  customer: {
    id: '00000000-0000-4000-8000-000000000021',
    name: 'Customer',
    phone: '08123456789',
    email: null,
  },
  service: {
    id: '00000000-0000-4000-8000-000000000022',
    name: 'Haircut',
    durationMinutes: 30,
    priceRupiah: 50_000,
  },
  barber: {
    id: '00000000-0000-4000-8000-000000000023',
    name: 'Barber',
  },
  shop: {
    id: owner.shopId,
    name: 'CukurPro',
    phone: '08123456789',
    email: 'shop@example.com',
    address: 'Jakarta',
    timezone: 'Asia/Jakarta',
  },
};

function authStub(user: AuthUser | null): AuthService {
  return {
    setupOwner: async () => null,
    signIn: async () => null,
    signOut: async () => undefined,
    getUser: async () => user,
    createStaff: async () => owner,
    listStaff: async () => [owner],
    updateStaff: async () => owner,
    deleteStaff: async () => false,
  };
}

function bookingStub(): BookingService {
  return {
    list: async () => [booking],
    createStaff: async () => booking,
    createWalkIn: async () => ({ ...booking, source: 'walk_in' }),
    createPublic: async () => booking,
    confirm: async () => ({ ...booking, status: 'confirmed' }),
    cancel: async () => ({ ...booking, status: 'cancelled' }),
    checkIn: async () => ({ ...booking, status: 'checked_in' }),
    startService: async () => ({ ...booking, status: 'in_service' }),
    complete: async () => ({ ...booking, status: 'completed' }),
    markNoShow: async () => ({ ...booking, status: 'no_show' }),
    reschedule: async () => ({ ...booking, status: 'rescheduled' }),
    getPublicOptions: async () => ({
      shop: booking.shop,
      services: [
        {
          id: booking.service.id,
          name: booking.service.name,
          description: '',
          durationMinutes: booking.service.durationMinutes,
          priceRupiah: booking.service.priceRupiah,
        },
      ],
      barbers: [
        {
          id: booking.barber.id,
          name: booking.barber.name,
          serviceIds: [booking.service.id],
        },
      ],
    }),
    findPublicAvailability: async () => null,
  };
}

function appFor(service: BookingService, user: AuthUser | null = owner) {
  return createApp({
    allowedOrigins: [],
    healthService: {
      check: async () => ({
        status: 'ok',
        services: { api: 'ok', database: 'ok' },
        timestamp: new Date().toISOString(),
      }),
    },
    authService: authStub(user),
    bookingService: service,
  });
}

describe('booking routes and conflicts', () => {
  it('exposes safe booking options without staff authentication', async () => {
    const response = await appFor(bookingStub()).request('/api/public/options');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      options: { shop: { name: 'CukurPro' } },
    });
  });

  it('requires staff authentication for appointment administration', async () => {
    const response = await appFor(bookingStub(), null).request('/api/bookings');
    expect(response.status).toBe(401);
  });

  it('returns a stable conflict when a concurrent request takes the slot', async () => {
    const service = bookingStub();
    service.createPublic = async () => {
      throw new BookingDomainError(
        'BOOKING_TIME_UNAVAILABLE',
        'The selected time was just reserved by another booking.',
        409,
      );
    };
    const response = await appFor(service).request('/api/public/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: booking.serviceId,
        barberId: booking.barberId,
        startAt: '2026-09-02T02:00:00.000Z',
        customer: {
          name: 'Customer',
          phone: '0812 3456 789',
          email: null,
        },
      }),
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'BOOKING_TIME_UNAVAILABLE',
        message: 'The selected time was just reserved by another booking.',
      },
    });
  });

  it('recognizes exclusion violations wrapped by the database layer', () => {
    expect(hasDatabaseCode({ cause: { code: '23P01' } }, '23P01')).toBe(true);
  });

  it('exposes operational transition endpoints to staff', async () => {
    const service = bookingStub();
    const app = appFor(service);
    const response = await app.request(`/api/bookings/${booking.id}/check-in`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      booking: { status: 'checked_in' },
    });
  });

  it('keeps walk-ins on the same booking route contract', async () => {
    const service = bookingStub();
    const app = appFor(service);
    const response = await app.request('/api/bookings/walk-ins', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId: booking.customerId,
        serviceId: booking.serviceId,
        barberId: booking.barberId,
        startAt: '2026-09-02T02:00:00.000Z',
        notes: 'Walk-in',
      }),
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      booking: { source: 'walk_in' },
    });
  });

  it('keeps the database exclusion constraint covering active lifecycle states', async () => {
    const migration = await readFile(
      new URL('../../drizzle/0003_small_skaar.sql', import.meta.url),
      'utf8',
    );
    expect(migration).toContain('EXCLUDE USING gist');
    expect(migration).toContain("'initial', 'confirmed', 'rescheduled'");
  });
});
