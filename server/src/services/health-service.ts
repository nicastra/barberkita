import type { DatabaseHealthService } from './database-health-service';

export type HealthStatus = 'ok' | 'degraded';

export interface HealthResult {
  status: HealthStatus;
  services: {
    api: 'ok';
    database: 'ok' | 'unavailable';
  };
  timestamp: string;
}

export interface HealthService {
  check(): Promise<HealthResult>;
}

export function createHealthService(
  databaseHealthService: DatabaseHealthService,
  now: () => Date = () => new Date(),
): HealthService {
  return {
    async check(): Promise<HealthResult> {
      try {
        await databaseHealthService.check();

        return {
          status: 'ok',
          services: { api: 'ok', database: 'ok' },
          timestamp: now().toISOString(),
        };
      } catch {
        return {
          status: 'degraded',
          services: { api: 'ok', database: 'unavailable' },
          timestamp: now().toISOString(),
        };
      }
    },
  };
}
