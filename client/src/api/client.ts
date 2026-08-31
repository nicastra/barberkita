import { z } from 'zod';

const clientEnvironmentSchema = z.object({
  VITE_API_BASE_URL: z.string().url().default('http://localhost:3000'),
});

const environment = clientEnvironmentSchema.parse(import.meta.env);

export class ApiError extends Error {
  public readonly status: number | undefined;
  public readonly code: string | undefined;

  public constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface ApiRequestOptions<T> {
  schema: z.ZodType<T>;
  acceptedStatuses?: number[];
  signal?: AbortSignal | undefined;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function apiRequest<T>(
  path: string,
  {
    schema,
    acceptedStatuses = [],
    signal,
    method = 'GET',
    body,
  }: ApiRequestOptions<T>,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(new URL(path, environment.VITE_API_BASE_URL), {
      headers:
        body === undefined
          ? { Accept: 'application/json' }
          : { Accept: 'application/json', 'Content-Type': 'application/json' },
      method,
      credentials: 'include',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    });
  } catch {
    throw new ApiError('The API could not be reached.');
  }

  let payload: unknown;
  try {
    payload = response.status === 204 ? null : await response.json();
  } catch {
    throw new ApiError(
      'The API returned an invalid response.',
      response.status,
    );
  }

  if (!response.ok && !acceptedStatuses.includes(response.status)) {
    const error = z
      .object({
        error: z.object({ code: z.string(), message: z.string() }),
      })
      .safeParse(payload);
    throw new ApiError(
      error.success ? error.data.error.message : 'The API request failed.',
      response.status,
      error.success ? error.data.error.code : undefined,
    );
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(
      'The API returned an invalid response.',
      response.status,
    );
  }

  return parsed.data;
}
