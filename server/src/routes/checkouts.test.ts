import { describe, expect, it } from 'vitest';

import { createApp } from '../app';
import type { AuthService, AuthUser } from '../services/auth-service';
import type {
  CheckoutService,
  CheckoutView,
} from '../services/checkout-service';

const owner: AuthUser = {
  id: '00000000-0000-4000-8000-000000000001',
  shopId: '00000000-0000-4000-8000-000000000002',
  name: 'Owner',
  email: 'owner@example.com',
  role: 'owner',
};
const staff = {
  ...owner,
  id: '00000000-0000-4000-8000-000000000003',
  role: 'staff' as const,
};
const checkout = { id: '00000000-0000-4000-8000-000000000010' } as CheckoutView;

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

function checkoutStub(): CheckoutService {
  return {
    list: async () => [checkout],
    create: async () => checkout,
    get: async () => checkout,
    recordPayment: async () => checkout,
    correctPayment: async () => checkout,
  };
}

function appFor(user: AuthUser | null) {
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
    checkoutService: checkoutStub(),
  });
}

describe('checkout routes', () => {
  it('requires staff authentication', async () => {
    const response = await appFor(null).request('/api/checkouts');
    expect(response.status).toBe(401);
  });

  it('keeps corrections owner-only', async () => {
    const response = await appFor(staff).request(
      `/api/checkouts/${checkout.id}/payments/00000000-0000-4000-8000-000000000011/corrections`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'void',
          reason: 'Duplicate',
          idempotencyKey: '00000000-0000-4000-8000-000000000012',
        }),
      },
    );
    expect(response.status).toBe(403);
  });

  it('validates references for non-cash payments', async () => {
    const response = await appFor(owner).request(
      `/api/checkouts/${checkout.id}/payments`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amountRupiah: 10_000,
          method: 'qris',
          idempotencyKey: '00000000-0000-4000-8000-000000000012',
        }),
      },
    );
    expect(response.status).toBe(400);
  });
});
