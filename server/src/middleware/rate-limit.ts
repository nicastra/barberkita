import { createMiddleware } from 'hono/factory';

type Bucket = { count: number; resetsAt: number };

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  now?: (() => number) | undefined;
  key?: ((headers: Headers, path: string) => string) | undefined;
}

const MAX_TRACKED_BUCKETS = 10_000;

function defaultKey(headers: Headers, path: string): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `${headers.get('cf-connecting-ip') ?? forwarded ?? 'unknown'}:${path}`;
}

export function createRateLimitMiddleware({
  limit,
  windowMs,
  now = Date.now,
  key = defaultKey,
}: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return createMiddleware(async (context, next) => {
    const currentTime = now();
    if (buckets.size >= MAX_TRACKED_BUCKETS) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetsAt <= currentTime) buckets.delete(bucketKey);
      }
      if (buckets.size >= MAX_TRACKED_BUCKETS) {
        const oldest = buckets.keys().next().value as string | undefined;
        if (oldest) buckets.delete(oldest);
      }
    }

    const bucketKey = key(context.req.raw.headers, context.req.path);
    const existing = buckets.get(bucketKey);
    const bucket =
      !existing || existing.resetsAt <= currentTime
        ? { count: 0, resetsAt: currentTime + windowMs }
        : existing;
    bucket.count += 1;
    buckets.set(bucketKey, bucket);

    const remaining = Math.max(0, limit - bucket.count);
    context.header('RateLimit-Limit', String(limit));
    context.header('RateLimit-Remaining', String(remaining));
    context.header(
      'RateLimit-Reset',
      String(Math.ceil(bucket.resetsAt / 1000)),
    );
    if (bucket.count > limit) {
      context.header(
        'Retry-After',
        String(Math.max(1, Math.ceil((bucket.resetsAt - currentTime) / 1000))),
      );
      return context.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please try again later.',
          },
        },
        429,
      );
    }
    await next();
  });
}
