import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { requireAuth, requireOwner } from '../middleware/auth';
import {
  createStaffSchema,
  reauthenticateSchema,
  signInSchema,
  staffIdSchema,
  updateStaffSchema,
} from '../schemas/auth';
import {
  AuthDomainError,
  type AuthService,
  type AuthUser,
} from '../services/auth-service';
import { tenantShopParamsSchema } from '../schemas/tenant';

function publicUser(user: AuthUser) {
  return {
    id: user.id,
    shopId: user.shopId,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function sessionCookie(token: string, secure: boolean, maxAge: number): string {
  return `cukurpro_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export function createAuthRoutes(
  authService: AuthService,
  secureCookies = false,
  enableLegacyStaff = true,
) {
  const app = new Hono<{
    Variables: { user: AuthUser; sessionToken: string };
  }>();
  app.onError((error, context) => {
    if (error instanceof AuthDomainError)
      return context.json(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    throw error;
  });
  app.post('/sign-in', zValidator('json', signInSchema), async (context) => {
    const result = await authService.signIn(
      context.req.valid('json').email,
      context.req.valid('json').password,
    );
    if (!result)
      return context.json(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.',
          },
        },
        401,
      );
    context.header(
      'Set-Cookie',
      sessionCookie(result.token, secureCookies, 604_800),
    );
    return context.json({ user: publicUser(result.user) });
  });
  app.post('/sign-out', requireAuth(authService), async (context) => {
    await authService.signOut(context.get('sessionToken'));
    context.header('Set-Cookie', sessionCookie('', secureCookies, 0));
    return context.body(null, 204);
  });
  app.post(
    '/reauthenticate',
    requireAuth(authService),
    zValidator('json', reauthenticateSchema),
    async (context) => {
      const reauthenticate = authService.reauthenticate;
      const valid = reauthenticate
        ? await reauthenticate(
            context.get('sessionToken'),
            context.req.valid('json').password,
          )
        : false;
      return valid
        ? context.json({ reauthenticated: true })
        : context.json(
            {
              error: {
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid password.',
              },
            },
            401,
          );
    },
  );
  app.get('/me', requireAuth(authService), (context) =>
    context.json({ user: publicUser(context.get('user')) }),
  );
  app.post(
    '/switch-shop/:shopId',
    requireAuth(authService),
    zValidator('param', tenantShopParamsSchema),
    async (context) => {
      const switchShop = authService.switchShop;
      if (!switchShop)
        return context.json(
          {
            error: {
              code: 'TENANT_ACCESS_DENIED',
              reason: 'INVALID_SCOPE',
              message:
                'Branch switching is unavailable until migration completes.',
            },
          },
          403,
        );
      const user = await switchShop(
        context.get('sessionToken'),
        context.req.valid('param').shopId,
      );
      return user
        ? context.json({ user: publicUser(user) })
        : context.json(
            {
              error: {
                code: 'TENANT_ACCESS_DENIED',
                reason: 'MEMBERSHIP_REQUIRED',
                message: 'You do not have access to this shop.',
              },
            },
            403,
          );
    },
  );
  const staff = new Hono<{
    Variables: { user: AuthUser; sessionToken: string };
  }>();
  staff.use('*', requireAuth(authService), requireOwner());
  staff.get('/', async (context) =>
    context.json({ staff: await authService.listStaff(context.get('user')) }),
  );
  staff.post('/', zValidator('json', createStaffSchema), async (context) =>
    context.json(
      {
        staff: await authService.createStaff(
          context.get('user'),
          context.req.valid('json'),
        ),
      },
      201,
    ),
  );
  staff.patch(
    '/:id',
    zValidator('param', staffIdSchema),
    zValidator('json', updateStaffSchema),
    async (context) => {
      const staffUser = await authService.updateStaff(
        context.get('user'),
        context.req.valid('param').id,
        context.req.valid('json'),
      );
      return staffUser
        ? context.json({ staff: staffUser })
        : context.json(
            {
              error: { code: 'NOT_FOUND', message: 'Staff member not found.' },
            },
            404,
          );
    },
  );
  staff.delete('/:id', zValidator('param', staffIdSchema), async (context) => {
    const deleted = await authService.deleteStaff(
      context.get('user'),
      context.req.valid('param').id,
    );
    return deleted
      ? context.body(null, 204)
      : context.json(
          { error: { code: 'NOT_FOUND', message: 'Staff member not found.' } },
          404,
        );
  });
  if (enableLegacyStaff) app.route('/staff', staff);
  return app;
}
