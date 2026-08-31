import { randomUUID } from 'node:crypto';

import { createMiddleware } from 'hono/factory';

export function createRequestLogger() {
  return createMiddleware(async (context, next) => {
    const suppliedRequestId = context.req.header('x-request-id');
    const requestId =
      suppliedRequestId && /^[A-Za-z0-9_-]{1,100}$/.test(suppliedRequestId)
        ? suppliedRequestId
        : randomUUID();
    const startedAt = performance.now();
    context.header('X-Request-Id', requestId);
    try {
      await next();
      logRequest(context.req.method, context.req.path, context.res.status);
    } catch (error) {
      logRequest(context.req.method, context.req.path, 500);
      throw error;
    }

    function logRequest(method: string, path: string, status: number) {
      console.info(
        JSON.stringify({
          level: 'info',
          event: 'http_request',
          requestId,
          method,
          path,
          status,
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        }),
      );
    }
  });
}
