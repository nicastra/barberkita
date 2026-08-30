import { describe, expect, it } from 'vitest';

import { parseConfig } from './config';

describe('parseConfig', () => {
  it('parses required settings and comma-separated allowed origins', () => {
    expect(
      parseConfig({
        PORT: '4100',
        DATABASE_URL: 'postgres://cukurpro:password@localhost:5432/cukurpro',
        ALLOWED_ORIGINS: 'http://localhost:5173,https://staff.cukurpro.example',
      }),
    ).toEqual({
      port: 4100,
      databaseUrl: 'postgres://cukurpro:password@localhost:5432/cukurpro',
      allowedOrigins: [
        'http://localhost:5173',
        'https://staff.cukurpro.example',
      ],
    });
  });

  it('rejects invalid settings without including their values in the error', () => {
    const invalidDatabaseUrl =
      'postgres://cukurpro:do-not-log-this@not a valid host/cukurpro';

    expect(() =>
      parseConfig({ DATABASE_URL: invalidDatabaseUrl }),
    ).toThrowError('Invalid server environment configuration.');

    try {
      parseConfig({ DATABASE_URL: invalidDatabaseUrl });
    } catch (error: unknown) {
      expect(String(error)).not.toContain('do-not-log-this');
    }
  });
});
