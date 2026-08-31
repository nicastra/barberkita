import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import type { AuthService, AuthUser } from '../services/auth-service';
import type { ReportingService } from '../services/reporting-service';

const user: AuthUser = {
  id: '00000000-0000-4000-8000-000000000001',
  shopId: '00000000-0000-4000-8000-000000000002',
  name: 'Staff',
  email: 'staff@example.com',
  role: 'staff',
};
function authStub(current: AuthUser | null): AuthService {
  return {
    setupOwner: async () => null,
    signIn: async () => null,
    signOut: async () => undefined,
    getUser: async () => current,
    createStaff: async () => user,
    listStaff: async () => [user],
    updateStaff: async () => user,
    deleteStaff: async () => false,
  };
}
function reportingStub(): ReportingService {
  return {
    dashboard: async () => ({
      date: '2026-08-31',
      timezone: 'Asia/Jakarta',
      totals: {
        appointments: 0,
        upcoming: 0,
        queue: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        initial: 0,
        confirmed: 0,
        rescheduled: 0,
        checkedIn: 0,
        inService: 0,
      },
      appointments: [],
    }),
    revenue: async () => ({
      from: '2026-08-31',
      to: '2026-08-31',
      timezone: 'Asia/Jakarta',
      grossRupiah: 0,
      correctionsRupiah: 0,
      netRupiah: 0,
      paymentCount: 0,
      transactionCount: 0,
    }),
    performance: async () => ({
      from: '2026-08-31',
      to: '2026-08-31',
      timezone: 'Asia/Jakarta',
      staff: [],
      services: [],
    }),
  };
}
function appFor(current: AuthUser | null) {
  return createApp({
    allowedOrigins: [],
    healthService: {
      check: async () => ({
        status: 'ok',
        services: { api: 'ok', database: 'ok' },
        timestamp: new Date().toISOString(),
      }),
    },
    authService: authStub(current),
    reportingService: reportingStub(),
  });
}
describe('reporting routes', () => {
  it('requires authentication and exposes the dashboard alias', async () => {
    expect((await appFor(null).request('/api/dashboard')).status).toBe(401);
    const response = await appFor(user).request(
      '/api/dashboard?date=2026-08-31',
      { headers: { Authorization: 'Bearer token' } },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      dashboard: { date: '2026-08-31' },
    });
  });
  it('rejects inverted report ranges before calling the service', async () => {
    const response = await appFor(user).request(
      '/api/reports/revenue?from=2026-09-02&to=2026-09-01',
      { headers: { Authorization: 'Bearer token' } },
    );
    expect(response.status).toBe(400);
  });
});
