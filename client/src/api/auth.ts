import { z } from 'zod';

import { apiRequest } from './client';

const userSchema = z.object({
  id: z.string(),
  shopId: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['owner', 'staff']),
});
export type AuthUser = z.infer<typeof userSchema>;
const authResponseSchema = z.object({ user: userSchema });

export function signIn(email: string, password: string) {
  return apiRequest('/api/auth/sign-in', {
    method: 'POST',
    body: { email, password },
    schema: authResponseSchema,
  });
}

export function signOut() {
  return apiRequest('/api/auth/sign-out', {
    method: 'POST',
    acceptedStatuses: [204],
    schema: z.object({}).or(z.null()),
  });
}

export function getSession() {
  return apiRequest('/api/auth/me', { schema: authResponseSchema });
}
