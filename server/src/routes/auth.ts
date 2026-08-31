import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { requireAuth, requireOwner } from '../middleware/auth';
import {
  createStaffSchema,
  setupSchema,
  signInSchema,
  staffIdSchema,
  updateStaffSchema,
} from '../schemas/auth';
import {
  AuthDomainError,
  type AuthService,
  type AuthUser,
} from '../services/auth-service';

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
  app.post('/setup', zValidator('json', setupSchema), async (context) => {
    const result = await authService.setupOwner(context.req.valid('json'));
    if (!result)
      return context.json(
        {
          error: {
            code: 'SETUP_COMPLETE',
            message: 'Initial owner setup has already been completed.',
          },
        },
        409,
      );
    return context.json(
      { user: publicUser(result.user), shop: result.shop },
      201,
    );
  });
  app.post('/sign-out', requireAuth(authService), async (context) => {
    await authService.signOut(context.get('sessionToken'));
    context.header('Set-Cookie', sessionCookie('', secureCookies, 0));
    return context.body(null, 204);
  });
  app.get('/me', requireAuth(authService), (context) =>
    context.json({ user: publicUser(context.get('user')) }),
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
  app.route('/staff', staff);
  return app;
}
