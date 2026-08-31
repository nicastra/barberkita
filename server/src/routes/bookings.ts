import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { requireAuth } from '../middleware/auth';
import {
  bookingIdSchema,
  bookingQuerySchema,
  createStaffBookingSchema,
  rescheduleBookingSchema,
  walkInBookingSchema,
} from '../schemas/bookings';
import type { AuthService, AuthUser } from '../services/auth-service';
import {
  BookingDomainError,
  type BookingService,
} from '../services/booking-service';

async function handleBooking<T>(operation: () => Promise<T>): Promise<T> {
  return operation();
}

export function createBookingRoutes(
  authService: AuthService,
  bookingService: BookingService,
) {
  const app = new Hono<{
    Variables: { user: AuthUser; sessionToken: string };
  }>();
  app.use('*', requireAuth(authService));
  app.onError((error, context) => {
    if (error instanceof BookingDomainError)
      return context.json(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    throw error;
  });
  app.get('/', zValidator('query', bookingQuerySchema), async (context) =>
    context.json({
      bookings: await bookingService.list(
        context.get('user'),
        context.req.valid('query'),
      ),
    }),
  );
  app.post('/', zValidator('json', createStaffBookingSchema), async (context) =>
    context.json(
      {
        booking: await handleBooking(() =>
          bookingService.createStaff(
            context.get('user'),
            context.req.valid('json'),
          ),
        ),
      },
      201,
    ),
  );
  app.post(
    '/walk-ins',
    zValidator('json', walkInBookingSchema),
    async (context) =>
      context.json(
        {
          booking: await bookingService.createWalkIn(
            context.get('user'),
            context.req.valid('json'),
          ),
        },
        201,
      ),
  );
  app.post(
    '/:id/confirm',
    zValidator('param', bookingIdSchema),
    async (context) =>
      context.json({
        booking: await bookingService.confirm(
          context.get('user'),
          context.req.valid('param').id,
        ),
      }),
  );
  app.post(
    '/:id/cancel',
    zValidator('param', bookingIdSchema),
    async (context) =>
      context.json({
        booking: await bookingService.cancel(
          context.get('user'),
          context.req.valid('param').id,
        ),
      }),
  );
  app.post(
    '/:id/check-in',
    zValidator('param', bookingIdSchema),
    async (context) =>
      context.json({
        booking: await bookingService.checkIn(
          context.get('user'),
          context.req.valid('param').id,
        ),
      }),
  );
  app.post(
    '/:id/start',
    zValidator('param', bookingIdSchema),
    async (context) =>
      context.json({
        booking: await bookingService.startService(
          context.get('user'),
          context.req.valid('param').id,
        ),
      }),
  );
  app.post(
    '/:id/complete',
    zValidator('param', bookingIdSchema),
    async (context) =>
      context.json({
        booking: await bookingService.complete(
          context.get('user'),
          context.req.valid('param').id,
        ),
      }),
  );
  app.post(
    '/:id/no-show',
    zValidator('param', bookingIdSchema),
    async (context) =>
      context.json({
        booking: await bookingService.markNoShow(
          context.get('user'),
          context.req.valid('param').id,
        ),
      }),
  );
  app.patch(
    '/:id/reschedule',
    zValidator('param', bookingIdSchema),
    zValidator('json', rescheduleBookingSchema),
    async (context) =>
      context.json({
        booking: await bookingService.reschedule(
          context.get('user'),
          context.req.valid('param').id,
          context.req.valid('json'),
        ),
      }),
  );
  return app;
}
