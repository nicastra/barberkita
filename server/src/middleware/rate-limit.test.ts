import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { createRateLimitMiddleware } from './rate-limit';

describe('rate limiting', () => {
  it('returns a stable retry response after the configured limit', async () => {
    let now = 1_000;
    const app = new Hono();
    app.use(
      '*',
      createRateLimitMiddleware({ limit: 2, windowMs: 1_000, now: () => now }),
    );
    app.get('/', (context) => context.json({ ok: true }));

    expect((await app.request('/')).status).toBe(200);
    expect((await app.request('/')).status).toBe(200);
    const limited = await app.request('/');
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('1');
    await expect(limited.json()).resolves.toMatchObject({
      error: { code: 'RATE_LIMITED' },
    });

    now = 2_000;
    expect((await app.request('/')).status).toBe(200);
  });
});
