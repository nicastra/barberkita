import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { requireAuth, requireOwner } from '../middleware/auth';
import {
  createBarberSchema,
  createScheduleExceptionSchema,
  createServiceSchema,
  exceptionParamsSchema,
  replaceBreaksSchema,
  replaceWorkingHoursSchema,
  resourceIdSchema,
  serviceAssignmentsSchema,
  updateBarberSchema,
  updateScheduleExceptionSchema,
  updateServiceSchema,
} from '../schemas/catalog';
import type { AuthService, AuthUser } from '../services/auth-service';
import {
  CatalogConflictError,
  type CatalogService,
} from '../services/catalog-service';

function notFound(context: {
  json: (
    body: { error: { code: string; message: string } },
    status: 404,
  ) => Response;
}) {
  return context.json(
    { error: { code: 'NOT_FOUND', message: 'Resource not found.' } },
    404,
  );
}

function conflict(
  context: {
    json: (
      body: { error: { code: string; message: string } },
      status: 409,
    ) => Response;
  },
  error: CatalogConflictError,
) {
  return context.json(
    { error: { code: 'CATALOG_CONFLICT', message: error.message } },
    409,
  );
}

export function createServiceRoutes(
  authService: AuthService,
  catalogService: CatalogService,
) {
  const app = new Hono<{
    Variables: { user: AuthUser; sessionToken: string };
  }>();
  app.use('*', requireAuth(authService));
  app.get('/', async (context) =>
    context.json({
      services: await catalogService.listServices(context.get('user').shopId),
    }),
  );
  app.post(
    '/',
    requireOwner(),
    zValidator('json', createServiceSchema),
    async (context) =>
      context.json(
        {
          service: await catalogService.createService(
            context.get('user'),
            context.req.valid('json'),
          ),
        },
        201,
      ),
  );
  app.patch(
    '/:id',
    requireOwner(),
    zValidator('param', resourceIdSchema),
    zValidator('json', updateServiceSchema),
    async (context) => {
      const service = await catalogService.updateService(
        context.get('user'),
        context.req.valid('param').id,
        context.req.valid('json'),
      );
      return service ? context.json({ service }) : notFound(context);
    },
  );
  return app;
}

export function createBarberRoutes(
  authService: AuthService,
  catalogService: CatalogService,
) {
  const app = new Hono<{
    Variables: { user: AuthUser; sessionToken: string };
  }>();
  app.use('*', requireAuth(authService));
  app.get('/', async (context) =>
    context.json({
      barbers: await catalogService.listBarbers(context.get('user').shopId),
    }),
  );
  app.post(
    '/',
    requireOwner(),
    zValidator('json', createBarberSchema),
    async (context) => {
      try {
        return context.json(
          {
            barber: await catalogService.createBarber(
              context.get('user'),
              context.req.valid('json'),
            ),
          },
          201,
        );
      } catch (error) {
        if (error instanceof CatalogConflictError)
          return conflict(context, error);
        throw error;
      }
    },
  );
  app.patch(
    '/:id',
    requireOwner(),
    zValidator('param', resourceIdSchema),
    zValidator('json', updateBarberSchema),
    async (context) => {
      try {
        const barber = await catalogService.updateBarber(
          context.get('user'),
          context.req.valid('param').id,
          context.req.valid('json'),
        );
        return barber ? context.json({ barber }) : notFound(context);
      } catch (error) {
        if (error instanceof CatalogConflictError)
          return conflict(context, error);
        throw error;
      }
    },
  );
  app.put(
    '/:id/services',
    requireOwner(),
    zValidator('param', resourceIdSchema),
    zValidator('json', serviceAssignmentsSchema),
    async (context) => {
      try {
        const barber = await catalogService.assignServices(
          context.get('user'),
          context.req.valid('param').id,
          context.req.valid('json').serviceIds,
        );
        return barber ? context.json({ barber }) : notFound(context);
      } catch (error) {
        if (error instanceof CatalogConflictError)
          return conflict(context, error);
        throw error;
      }
    },
  );
  app.get(
    '/:id/schedule',
    zValidator('param', resourceIdSchema),
    async (context) => {
      const schedule = await catalogService.getSchedule(
        context.get('user').shopId,
        context.req.valid('param').id,
      );
      return schedule ? context.json({ schedule }) : notFound(context);
    },
  );
  app.put(
    '/:id/working-hours',
    requireOwner(),
    zValidator('param', resourceIdSchema),
    zValidator('json', replaceWorkingHoursSchema),
    async (context) => {
      try {
        const schedule = await catalogService.replaceWorkingHours(
          context.get('user'),
          context.req.valid('param').id,
          context.req.valid('json').hours,
        );
        return schedule ? context.json({ schedule }) : notFound(context);
      } catch (error) {
        if (error instanceof CatalogConflictError)
          return conflict(context, error);
        throw error;
      }
    },
  );
  app.put(
    '/:id/breaks',
    requireOwner(),
    zValidator('param', resourceIdSchema),
    zValidator('json', replaceBreaksSchema),
    async (context) => {
      try {
        const schedule = await catalogService.replaceBreaks(
          context.get('user'),
          context.req.valid('param').id,
          context.req.valid('json').breaks,
        );
        return schedule ? context.json({ schedule }) : notFound(context);
      } catch (error) {
        if (error instanceof CatalogConflictError)
          return conflict(context, error);
        throw error;
      }
    },
  );
  app.post(
    '/:id/exceptions',
    requireOwner(),
    zValidator('param', resourceIdSchema),
    zValidator('json', createScheduleExceptionSchema),
    async (context) => {
      const exception = await catalogService.createException(
        context.get('user'),
        context.req.valid('param').id,
        context.req.valid('json'),
      );
      return exception ? context.json({ exception }, 201) : notFound(context);
    },
  );
  app.patch(
    '/:id/exceptions/:exceptionId',
    requireOwner(),
    zValidator('param', exceptionParamsSchema),
    zValidator('json', updateScheduleExceptionSchema),
    async (context) => {
      const params = context.req.valid('param');
      const exception = await catalogService.updateException(
        context.get('user'),
        params.id,
        params.exceptionId,
        context.req.valid('json'),
      );
      return exception ? context.json({ exception }) : notFound(context);
    },
  );
  app.delete(
    '/:id/exceptions/:exceptionId',
    requireOwner(),
    zValidator('param', exceptionParamsSchema),
    async (context) => {
      const params = context.req.valid('param');
      const deleted = await catalogService.deleteException(
        context.get('user'),
        params.id,
        params.exceptionId,
      );
      return deleted ? context.body(null, 204) : notFound(context);
    },
  );
  return app;
}
