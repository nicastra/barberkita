import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { invitationAcceptSchema, invitationTokenSchema } from '../schemas/auth';
import type { InvitationService } from '../services/invitation-service';

/** Public acceptance endpoint; the raw token is never persisted or logged. */
export function createInvitationRoutes(invitationService: InvitationService) {
  const app = new Hono();
  app.post(
    '/:token/accept',
    zValidator('param', invitationTokenSchema),
    zValidator('json', invitationAcceptSchema),
    async (context) => {
      try {
        const result = await invitationService.accept(
          context.req.valid('param').token,
          context.req.valid('json'),
        );
        return context.json({ accepted: true, ...result }, 200);
      } catch {
        return context.json(
          {
            error: {
              code: 'INVITATION_UNAVAILABLE',
              message: 'This invitation is expired, revoked, or already used.',
            },
          },
          400,
        );
      }
    },
  );
  return app;
}
