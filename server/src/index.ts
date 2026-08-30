import { createApp } from './app';
import { parseConfig } from './config';
import { createDatabase } from './db/client';
import { createDatabaseHealthService } from './services/database-health-service';
import { createHealthService } from './services/health-service';
import { createAuthService } from './services/auth-service';
import { createShopService } from './services/shop-service';

const config = parseConfig(process.env);
const { database } = createDatabase(config.databaseUrl);
const databaseHealthService = createDatabaseHealthService(database);
const healthService = createHealthService(databaseHealthService);
const authService = createAuthService(database);
const shopService = createShopService(database);
const app = createApp({
  allowedOrigins: config.allowedOrigins,
  healthService,
  authService,
  shopService,
});

const server = Bun.serve({
  port: config.port,
  fetch: app.fetch,
});

console.log(`CukurPro API listening on ${server.url}`);
