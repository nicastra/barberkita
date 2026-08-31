import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import {
  createPublicBookingSchema,
  publicAvailabilityQuerySchema,
} from '../schemas/bookings';
import {
  BookingDomainError,
  type BookingService,
} from '../services/booking-service';

export function createPublicBookingRoutes(bookingService: BookingService) {
  const app = new Hono();
  app.onError((error, context) => {
    if (error instanceof BookingDomainError)
      return context.json(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    throw error;
  });
  app.get('/options', async (context) => {
    const options = await bookingService.getPublicOptions();
    return options
      ? context.json({ options })
      : context.json(
          {
            error: {
              code: 'SHOP_NOT_READY',
              message: 'Public booking is not available yet.',
            },
          },
          404,
        );
  });
  app.get(
    '/availability',
    zValidator('query', publicAvailabilityQuerySchema),
    async (context) => {
      const availability = await bookingService.findPublicAvailability(
        context.req.valid('query'),
      );
      return availability
        ? context.json({ availability })
        : context.json(
            {
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'The selected service is not available.',
              },
            },
            404,
          );
    },
  );
  app.post(
    '/bookings',
    zValidator('json', createPublicBookingSchema),
    async (context) =>
      context.json(
        {
          booking: await bookingService.createPublic(context.req.valid('json')),
        },
        201,
      ),
  );
  return app;
}
