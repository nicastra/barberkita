import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { requireAuth } from '../middleware/auth';
import { availabilityQuerySchema } from '../schemas/catalog';
import type { AuthService, AuthUser } from '../services/auth-service';
import type { AvailabilityService } from '../services/availability-service';

export function createAvailabilityRoutes(
  authService: AuthService,
  availabilityService: AvailabilityService,
) {
  const app = new Hono<{
    Variables: { user: AuthUser; sessionToken: string };
  }>();
  app.use('*', requireAuth(authService));
  app.get(
    '/',
    zValidator('query', availabilityQuerySchema),
    async (context) => {
      const query = context.req.valid('query');
      const availability = await availabilityService.findSlots({
        shopId: context.get('user').shopId,
        serviceId: query.serviceId,
        date: query.date,
        barberId: query.barberId,
        intervalMinutes: query.intervalMinutes,
      });
      return availability
        ? context.json({ availability })
        : context.json(
            {
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'The service is not available for new work.',
              },
            },
            404,
          );
    },
  );
  return app;
}
