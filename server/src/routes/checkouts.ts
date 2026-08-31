import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { requireAuth, requireOwner } from '../middleware/auth';
import {
  checkoutIdSchema,
  checkoutPaymentParamsSchema,
  checkoutQuerySchema,
  createCheckoutSchema,
  paymentCorrectionSchema,
  recordPaymentSchema,
} from '../schemas/checkouts';
import type { AuthService, AuthUser } from '../services/auth-service';
import {
  CheckoutDomainError,
  type CheckoutService,
} from '../services/checkout-service';

export function createCheckoutRoutes(
  authService: AuthService,
  checkoutService: CheckoutService,
) {
  const app = new Hono<{
    Variables: { user: AuthUser; sessionToken: string };
  }>();
  app.use('*', requireAuth(authService));
  app.onError((error, context) => {
    if (error instanceof CheckoutDomainError)
      return context.json(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    throw error;
  });

  app.get('/', zValidator('query', checkoutQuerySchema), async (context) =>
    context.json({
      checkouts: await checkoutService.list(
        context.get('user'),
        context.req.valid('query'),
      ),
    }),
  );
  app.post('/', zValidator('json', createCheckoutSchema), async (context) =>
    context.json(
      {
        checkout: await checkoutService.create(
          context.get('user'),
          context.req.valid('json'),
        ),
      },
      201,
    ),
  );
  app.get('/:id', zValidator('param', checkoutIdSchema), async (context) => {
    const checkout = await checkoutService.get(
      context.get('user'),
      context.req.valid('param').id,
    );
    if (!checkout)
      return context.json(
        { error: { code: 'NOT_FOUND', message: 'Checkout not found.' } },
        404,
      );
    return context.json({ checkout });
  });
  app.post(
    '/:id/payments',
    zValidator('param', checkoutIdSchema),
    zValidator('json', recordPaymentSchema),
    async (context) =>
      context.json({
        checkout: await checkoutService.recordPayment(
          context.get('user'),
          context.req.valid('param').id,
          context.req.valid('json'),
        ),
      }),
  );
  app.post(
    '/:id/payments/:paymentId/corrections',
    requireOwner(),
    zValidator('param', checkoutPaymentParamsSchema),
    zValidator('json', paymentCorrectionSchema),
    async (context) =>
      context.json({
        checkout: await checkoutService.correctPayment(
          context.get('user'),
          context.req.valid('param').id,
          context.req.valid('param').paymentId,
          context.req.valid('json'),
        ),
      }),
  );
  return app;
}
