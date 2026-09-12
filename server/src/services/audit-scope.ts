import type { AuthUser } from './auth-service';

/**
 * Audit rows are always scoped when the request has an authorized tenant.
 * Global events (for example an unknown-email sign-in failure) deliberately
 * return null scope because no tenant can be trusted for that event.
 */
export function auditScope(actor: AuthUser): {
  organizationId: string | null;
  shopId: string | null;
} {
  return {
    organizationId: actor.tenant?.organizationId ?? null,
    shopId: actor.shopId || null,
  };
}
