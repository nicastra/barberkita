import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { requireAuth } from '../middleware/auth';
import {
  customerIdSchema,
  customerInputSchema,
  customerQuerySchema,
  updateCustomerSchema,
} from '../schemas/customers';
import type { AuthService, AuthUser } from '../services/auth-service';
import {
  CustomerConflictError,
  type CustomerService,
} from '../services/customer-service';

export function createCustomerRoutes(
  authService: AuthService,
  customerService: CustomerService,
) {
  const app = new Hono<{
    Variables: { user: AuthUser; sessionToken: string };
  }>();
  app.use('*', requireAuth(authService));
  app.get('/', zValidator('query', customerQuerySchema), async (context) =>
    context.json({
      customers: await customerService.list(
        context.get('user').shopId,
        context.req.valid('query').search,
      ),
    }),
  );
  app.post('/', zValidator('json', customerInputSchema), async (context) => {
    const result = await customerService.create(
      context.get('user').shopId,
      context.req.valid('json'),
      context.get('user').id,
    );
    return context.json(
      { customer: result.customer, duplicate: !result.created },
      result.created ? 201 : 200,
    );
  });
  app.patch(
    '/:id',
    zValidator('param', customerIdSchema),
    zValidator('json', updateCustomerSchema),
    async (context) => {
      try {
        const customer = await customerService.update(
          context.get('user'),
          context.req.valid('param').id,
          context.req.valid('json'),
        );
        return customer
          ? context.json({ customer })
          : context.json(
              {
                error: {
                  code: 'NOT_FOUND',
                  message: 'Customer not found.',
                },
              },
              404,
            );
      } catch (error) {
        if (error instanceof CustomerConflictError)
          return context.json(
            {
              error: {
                code: 'CUSTOMER_DUPLICATE',
                message: error.message,
              },
            },
            409,
          );
        throw error;
      }
    },
  );
  return app;
}
