import { describe, expect, it, vi } from 'vitest';

import type { AuthService, AuthUser } from '../services/auth-service';
import type { AvailabilityService } from '../services/availability-service';
import type { CatalogService } from '../services/catalog-service';
import { createAvailabilityRoutes } from './availability';
import { createBarberRoutes, createServiceRoutes } from './catalog';

const owner: AuthUser = {
  id: '00000000-0000-0000-0000-000000000001',
  shopId: '00000000-0000-0000-0000-000000000002',
  name: 'Owner',
  email: 'owner@example.com',
  role: 'owner',
};

function authStub(user: AuthUser): AuthService {
  return {
    setupOwner: async () => null,
    signIn: async () => null,
    signOut: async () => undefined,
    getUser: async () => user,
    createStaff: async () => user,
    listStaff: async () => [user],
    updateStaff: async () => user,
    deleteStaff: async () => false,
  };
}

function catalogStub(): CatalogService {
  return {
    listServices: async () => [],
    createService: async (actor, input) => ({
      id: '00000000-0000-4000-8000-000000000010',
      shopId: actor.shopId,
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    updateService: async () => null,
    listBarbers: async () => [],
    createBarber: async (actor, input) => ({
      id: '00000000-0000-4000-8000-000000000011',
      shopId: actor.shopId,
      ...input,
      serviceIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    updateBarber: async () => null,
    assignServices: async () => null,
    getSchedule: async () => ({ hours: [], breaks: [], exceptions: [] }),
    replaceWorkingHours: async () => ({
      hours: [],
      breaks: [],
      exceptions: [],
    }),
    replaceBreaks: async () => ({
      hours: [],
      breaks: [],
      exceptions: [],
    }),
    createException: async () => null,
    updateException: async () => null,
    deleteException: async () => false,
  };
}

describe('Phase 2 route boundaries', () => {
  it('does not allow regular staff to create catalog services', async () => {
    const catalog = catalogStub();
    const create = vi.spyOn(catalog, 'createService');
    const app = createServiceRoutes(
      authStub({ ...owner, role: 'staff' }),
      catalog,
    );
    const response = await app.request('/', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Haircut',
        durationMinutes: 30,
        priceRupiah: 50_000,
      }),
    });

    expect(response.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects non-positive service duration before calling the service', async () => {
    const catalog = catalogStub();
    const create = vi.spyOn(catalog, 'createService');
    const app = createServiceRoutes(authStub(owner), catalog);
    const response = await app.request('/', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Haircut',
        durationMinutes: 0,
        priceRupiah: 50_000,
      }),
    });

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an unavailable range whose end is before its start', async () => {
    const catalog = catalogStub();
    const create = vi.spyOn(catalog, 'createException');
    const app = createBarberRoutes(authStub(owner), catalog);
    const response = await app.request(
      '/00000000-0000-4000-8000-000000000011/exceptions',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: '2026-09-01',
          kind: 'unavailable',
          startTime: '14:00',
          endTime: '13:00',
        }),
      },
    );

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('does not offer an inactive service for availability', async () => {
    const availability: AvailabilityService = { findSlots: async () => null };
    const app = createAvailabilityRoutes(authStub(owner), availability);
    const response = await app.request(
      '/?serviceId=00000000-0000-4000-8000-000000000010&date=2026-09-01',
      { headers: { Authorization: 'Bearer token' } },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'SERVICE_UNAVAILABLE' },
    });
  });
});
