import { describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { createHealthService } from '../services/health-service';

const TEST_TIME = new Date('2026-08-30T08:00:00.000Z');

describe('GET /api/health', () => {
  it('reports a healthy API and database', async () => {
    const healthService = createHealthService(
      { check: async () => undefined },
      () => TEST_TIME,
    );
    const app = createApp({
      allowedOrigins: ['http://localhost:5173'],
      healthService,
    });

    const response = await app.request('/api/health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      services: { api: 'ok', database: 'ok' },
      timestamp: TEST_TIME.toISOString(),
    });
  });

  it('reports unavailable database connectivity without exposing the error', async () => {
    const healthService = createHealthService(
      {
        check: async () => {
          throw new Error('postgres://user:secret@database/internal');
        },
      },
      () => TEST_TIME,
    );
    const app = createApp({
      allowedOrigins: ['http://localhost:5173'],
      healthService,
    });

    const response = await app.request('/api/health');
    const responseText = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(responseText)).toEqual({
      status: 'degraded',
      services: { api: 'ok', database: 'unavailable' },
      timestamp: TEST_TIME.toISOString(),
    });
    expect(responseText).not.toContain('secret');
    expect(responseText).not.toContain('postgres://');
  });
});
