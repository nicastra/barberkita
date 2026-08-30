import { Hono } from 'hono';

import type { HealthService } from '../services/health-service';

export function createHealthRoutes(healthService: HealthService): Hono {
  const routes = new Hono();

  routes.get('/', async (context) => {
    const health = await healthService.check();
    return context.json(health, health.status === 'ok' ? 200 : 503);
  });

  return routes;
}
