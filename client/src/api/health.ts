import { z } from 'zod';

import { apiRequest } from './client';

const healthyResponseSchema = z.object({
  status: z.literal('ok'),
  services: z.object({
    api: z.literal('ok'),
    database: z.literal('ok'),
  }),
  timestamp: z.string().datetime({ offset: true }),
});

const degradedResponseSchema = z.object({
  status: z.literal('degraded'),
  services: z.object({
    api: z.literal('ok'),
    database: z.literal('unavailable'),
  }),
  timestamp: z.string().datetime({ offset: true }),
});

export const healthResponseSchema = z.discriminatedUnion('status', [
  healthyResponseSchema,
  degradedResponseSchema,
]);

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiRequest('/api/health', {
    schema: healthResponseSchema,
    acceptedStatuses: [503],
    ...(signal ? { signal } : {}),
  });
}
