import { describe, expect, it } from 'vitest';

import { createInvitationRoutes } from './invitations';

describe('invitation acceptance route', () => {
  it('does not reveal whether an invalid token exists', async () => {
    const response = await createInvitationRoutes({
      create: async () => {
        throw new Error('unused');
      },
      list: async () => [],
      revoke: async () => false,
      accept: async () => {
        throw new Error('unavailable');
      },
    }).request(`/${'a'.repeat(43)}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'a-strong-password-123' }),
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'INVITATION_UNAVAILABLE',
        message: 'This invitation is expired, revoked, or already used.',
      },
    });
  });
});
