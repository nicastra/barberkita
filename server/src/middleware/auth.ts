import { createMiddleware } from 'hono/factory';

import type { AuthService, AuthUser } from '../services/auth-service';

export type AuthVariables = { user: AuthUser; sessionToken: string };

export function requireAuth(authService: AuthService) {
  return createMiddleware<{ Variables: AuthVariables }>(
    async (context, next) => {
      const header = context.req.header('Authorization');
      const cookie = context.req
        .header('Cookie')
        ?.match(/(?:^|;\s*)cukurpro_session=([^;]+)/)?.[1];
      const token = header?.startsWith('Bearer ')
        ? header.slice(7).trim()
        : cookie;
      if (!token)
        return context.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication is required.',
            },
          },
          401,
        );
      const user = await authService.getUser(token);
      if (!user)
        return context.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication is required.',
            },
          },
          401,
        );
      context.set('user', user);
      context.set('sessionToken', token);
      await next();
    },
  );
}

export function requireOwner() {
  return createMiddleware<{ Variables: AuthVariables }>(
    async (context, next) => {
      if (context.get('user').role !== 'owner')
        return context.json(
          {
            error: { code: 'FORBIDDEN', message: 'Owner access is required.' },
          },
          403,
        );
      await next();
    },
  );
}
