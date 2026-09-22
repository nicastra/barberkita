import { describe, expect, it } from 'vitest';

import { createApp } from '../app';
import type { AuthService, AuthUser } from '../services/auth-service';
import { createAuthRoutes } from './auth';

const owner: AuthUser = {
  id: '00000000-0000-0000-0000-000000000001',
  shopId: '00000000-0000-0000-0000-000000000002',
  name: 'Owner',
  email: 'owner@example.com',
  role: 'owner',
};
const staff: AuthUser = {
  ...owner,
  id: '00000000-0000-0000-0000-000000000003',
  role: 'staff',
};

function authStub(user: AuthUser | null): AuthService {
  return {
    signIn: async () => null,
    signOut: async () => undefined,
    getUser: async () => user,
    createStaff: async () => staff,
    listStaff: async () => [staff],
    updateStaff: async () => staff,
    deleteStaff: async () => true,
  };
}

function appFor(authService: AuthService) {
  return createApp({
    allowedOrigins: [],
    healthService: {
      check: async () => ({
        status: 'ok',
        services: { api: 'ok', database: 'ok' },
        timestamp: new Date().toISOString(),
      }),
    },
    authService,
    enableLegacyRoutes: true,
  });
}

describe('authentication boundaries', () => {
  it('does not expose legacy global setup', async () => {
    const response = await appFor(authStub(null)).request('/api/auth/setup', {
      method: 'POST',
    });
    expect(response.status).toBe(404);
  });
  it('keeps unscoped operational routes disabled by default', async () => {
    const response = await createApp({
      allowedOrigins: [],
      healthService: {
        check: async () => ({
          status: 'ok',
          services: { api: 'ok', database: 'ok' },
          timestamp: new Date().toISOString(),
        }),
      },
      authService: authStub(owner),
    }).request('/api/bookings', {
      headers: { Authorization: 'Bearer token' },
    });
    expect(response.status).toBe(404);
  });
  it('returns a generic error for invalid credentials', async () => {
    const response = await appFor(authStub(null)).request('/api/auth/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'missing@example.com',
        password: 'incorrect-password',
      }),
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
    });
  });

  it('does not allow staff to access owner staff administration', async () => {
    const response = await appFor(authStub(staff)).request('/api/auth/staff', {
      headers: { Authorization: 'Bearer token' },
    });
    expect(response.status).toBe(403);
  });

  it('sets an explicitly secure production session cookie', async () => {
    const service = authStub(owner);
    service.signIn = async () => ({ user: owner, token: 'session-token' });
    const response = await createAuthRoutes(service, true).request('/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@example.com',
        password: 'OwnerPassword123!',
      }),
    });
    expect(response.headers.get('Set-Cookie')).toContain(
      'HttpOnly; Path=/; SameSite=Lax; Max-Age=604800; Secure',
    );
  });

  it('switches the active branch through the authenticated session', async () => {
    const service = authStub(owner);
    service.switchShop = async (_token, shopId) => ({ ...owner, shopId });
    const response = await createAuthRoutes(service).request(
      '/switch-shop/00000000-0000-4000-8000-000000000099',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
      },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      user: { shopId: '00000000-0000-4000-8000-000000000099' },
    });
  });

  it('supports a recent password reauthentication check', async () => {
    const service = authStub(owner);
    service.reauthenticate = async () => true;
    const response = await createAuthRoutes(service).request(
      '/reauthenticate',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: 'OwnerPassword123!' }),
      },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ reauthenticated: true });
  });

  it('rejects an oversized body before authentication parsing', async () => {
    const response = await createApp({
      allowedOrigins: [],
      maxRequestBodyBytes: 1_024,
      healthService: {
        check: async () => ({
          status: 'ok',
          services: { api: 'ok', database: 'ok' },
          timestamp: new Date().toISOString(),
        }),
      },
      authService: authStub(null),
    }).request('/api/auth/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@example.com',
        password: 'x'.repeat(2_000),
      }),
    });
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'REQUEST_TOO_LARGE' },
    });
  });
});
