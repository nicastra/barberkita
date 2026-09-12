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
import { publicShopParamsSchema } from '../schemas/tenant';

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

/** Public storefront routes scoped by the organization-owned shop slug. */
export function createScopedPublicBookingRoutes(
  bookingService: BookingService,
) {
  const app = new Hono();
  app.use('*', zValidator('param', publicShopParamsSchema));
  app.onError((error, context) => {
    if (error instanceof BookingDomainError)
      return context.json(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    throw error;
  });
  app.get('/options', async (context) => {
    const slug = context.req.param('shopSlug') ?? '';
    const options = bookingService.getPublicOptionsForShop
      ? await bookingService.getPublicOptionsForShop(slug)
      : null;
    return options
      ? context.json({ options })
      : context.json(
          {
            error: {
              code: 'PUBLIC_BOOKING_UNAVAILABLE',
              message: 'Public booking is not available for this shop.',
            },
          },
          404,
        );
  });
  app.get(
    '/availability',
    zValidator('query', publicAvailabilityQuerySchema),
    async (context) => {
      const result = context.req.valid('query');
      const availability = bookingService.findPublicAvailabilityForShop
        ? await bookingService.findPublicAvailabilityForShop({
            shopSlug: context.req.param('shopSlug') ?? '',
            ...result,
          })
        : null;
      return availability
        ? context.json({ availability })
        : context.json(
            {
              error: {
                code: 'PUBLIC_BOOKING_UNAVAILABLE',
                message: 'The selected service is not available for this shop.',
              },
            },
            404,
          );
    },
  );
  app.post(
    '/bookings',
    zValidator('json', createPublicBookingSchema),
    async (context) => {
      const booking = bookingService.createPublicForShop
        ? await bookingService.createPublicForShop(
            context.req.param('shopSlug') ?? '',
            context.req.valid('json'),
          )
        : null;
      return booking
        ? context.json({ booking }, 201)
        : context.json(
            {
              error: {
                code: 'PUBLIC_BOOKING_UNAVAILABLE',
                message: 'Public booking is not available for this shop.',
              },
            },
            404,
          );
    },
  );
  return app;
}
