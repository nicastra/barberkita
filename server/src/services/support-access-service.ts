import { and, eq } from 'drizzle-orm';

import type { Database } from '../db/client';
import {
  organizationMemberships,
  platformAdmins,
  organizations,
  supportGrantEvents,
  supportGrants,
  users,
} from '../db/schema';

export type SupportGrantView = {
  id: string;
  organizationId: string;
  providerUserId: string;
  requestedByUserId: string;
  approvedByUserId: string | null;
  reason: string;
  status: 'pending_approval' | 'active' | 'revoked' | 'expired';
  breakGlass: boolean;
  expiresAt: Date;
  approvedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export class SupportAccessError extends Error {
  public constructor(
    public readonly code:
      | 'SUPPORT_ACCESS_DENIED'
      | 'SUPPORT_GRANT_NOT_FOUND'
      | 'SUPPORT_GRANT_EXPIRED'
      | 'SUPPORT_GRANT_INVALID',
    message: string,
  ) {
    super(message);
  }
}

export interface SupportAccessService {
  request(
    providerUserId: string,
    input: { organizationId: string; reason: string; expiresInMinutes: number },
  ): Promise<SupportGrantView>;
  approve(ownerUserId: string, grantId: string): Promise<SupportGrantView>;
  createBreakGlass(
    providerUserId: string,
    input: { organizationId: string; reason: string; expiresInMinutes: number },
  ): Promise<SupportGrantView>;
  revoke(actorUserId: string, grantId: string): Promise<SupportGrantView>;
  listForOrganization(
    ownerUserId: string,
    organizationId: string,
  ): Promise<SupportGrantView[]>;
  listForProvider(providerUserId: string): Promise<SupportGrantView[]>;
  authorize(
    providerUserId: string,
    grantId: string,
    organizationId: string,
  ): Promise<SupportGrantView>;
  recordOperationalAction?(
    providerUserId: string,
    grantId: string,
    organizationId: string,
    action: string,
  ): Promise<void>;
}

function view(row: typeof supportGrants.$inferSelect): SupportGrantView {
  return row;
}

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

async function isProvider(database: Database | Transaction, userId: string) {
  const row = await database
    .select({ userId: platformAdmins.userId })
    .from(platformAdmins)
    .innerJoin(users, eq(users.id, platformAdmins.userId))
    .where(and(eq(platformAdmins.userId, userId), eq(users.active, true)))
    .limit(1)
    .then((rows) => rows[0]);
  return Boolean(row);
}

async function appendEvent(
  database: Database | Transaction,
  grant: typeof supportGrants.$inferSelect,
  actorUserId: string | null,
  action: string,
  reason?: string,
) {
  await database.insert(supportGrantEvents).values({
    grantId: grant.id,
    organizationId: grant.organizationId,
    actorUserId,
    action,
    reason: reason ?? null,
    metadata: {
      expiresAt: grant.expiresAt.toISOString(),
      breakGlass: grant.breakGlass,
    },
  });
}

export function createSupportAccessService(
  database: Database,
  now: () => Date = () => new Date(),
): SupportAccessService {
  return {
    async request(providerUserId, input) {
      if (!(await isProvider(database, providerUserId)))
        throw new SupportAccessError(
          'SUPPORT_ACCESS_DENIED',
          'Platform administrator access is required.',
        );
      const organization = await database
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1)
        .then((rows) => rows[0]);
      if (!organization)
        throw new SupportAccessError(
          'SUPPORT_GRANT_NOT_FOUND',
          'Organization not found.',
        );
      const expiresAt = new Date(
        now().getTime() + input.expiresInMinutes * 60_000,
      );
      const [grant] = await database
        .insert(supportGrants)
        .values({
          organizationId: input.organizationId,
          providerUserId,
          requestedByUserId: providerUserId,
          reason: input.reason,
          expiresAt,
        })
        .returning();
      if (!grant) throw new Error('Support grant creation failed.');
      await appendEvent(
        database,
        grant,
        providerUserId,
        'requested',
        input.reason,
      );
      return view(grant);
    },
    async approve(ownerUserId, grantId) {
      return database.transaction(async (transaction) => {
        const grant = await transaction
          .select()
          .from(supportGrants)
          .where(eq(supportGrants.id, grantId))
          .for('update')
          .limit(1)
          .then((rows) => rows[0]);
        if (!grant)
          throw new SupportAccessError(
            'SUPPORT_GRANT_NOT_FOUND',
            'Support grant not found.',
          );
        const owner = await transaction
          .select({ userId: organizationMemberships.userId })
          .from(organizationMemberships)
          .where(
            and(
              eq(organizationMemberships.organizationId, grant.organizationId),
              eq(organizationMemberships.userId, ownerUserId),
              eq(organizationMemberships.role, 'organization_owner'),
              eq(organizationMemberships.active, true),
            ),
          )
          .limit(1)
          .then((rows) => rows[0]);
        if (!owner)
          throw new SupportAccessError(
            'SUPPORT_ACCESS_DENIED',
            'Organization-owner approval is required.',
          );
        if (grant.status !== 'pending_approval')
          throw new SupportAccessError(
            'SUPPORT_GRANT_INVALID',
            'This support grant is no longer awaiting approval.',
          );
        if (grant.expiresAt <= now()) {
          const [expired] = await transaction
            .update(supportGrants)
            .set({ status: 'expired' })
            .where(eq(supportGrants.id, grant.id))
            .returning();
          if (expired)
            await appendEvent(transaction, expired, ownerUserId, 'expired');
          throw new SupportAccessError(
            'SUPPORT_GRANT_EXPIRED',
            'This support grant has expired.',
          );
        }
        const [approved] = await transaction
          .update(supportGrants)
          .set({
            status: 'active',
            approvedByUserId: ownerUserId,
            approvedAt: now(),
          })
          .where(eq(supportGrants.id, grant.id))
          .returning();
        if (!approved) throw new Error('Support grant approval failed.');
        await appendEvent(transaction, approved, ownerUserId, 'approved');
        return view(approved);
      });
    },
    async createBreakGlass(providerUserId, input) {
      if (!(await isProvider(database, providerUserId)))
        throw new SupportAccessError(
          'SUPPORT_ACCESS_DENIED',
          'Platform administrator access is required.',
        );
      const organization = await database
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1)
        .then((rows) => rows[0]);
      if (!organization)
        throw new SupportAccessError(
          'SUPPORT_GRANT_NOT_FOUND',
          'Organization not found.',
        );
      const [grant] = await database
        .insert(supportGrants)
        .values({
          organizationId: input.organizationId,
          providerUserId,
          requestedByUserId: providerUserId,
          approvedByUserId: providerUserId,
          reason: input.reason,
          status: 'active',
          breakGlass: true,
          expiresAt: new Date(
            now().getTime() + input.expiresInMinutes * 60_000,
          ),
          approvedAt: now(),
        })
        .returning();
      if (!grant) throw new Error('Break-glass grant creation failed.');
      await appendEvent(
        database,
        grant,
        providerUserId,
        'break_glass_created',
        input.reason,
      );
      return view(grant);
    },
    async revoke(actorUserId, grantId) {
      return database.transaction(async (transaction) => {
        const grant = await transaction
          .select()
          .from(supportGrants)
          .where(eq(supportGrants.id, grantId))
          .for('update')
          .limit(1)
          .then((rows) => rows[0]);
        if (!grant)
          throw new SupportAccessError(
            'SUPPORT_GRANT_NOT_FOUND',
            'Support grant not found.',
          );
        const owner = await transaction
          .select({ userId: organizationMemberships.userId })
          .from(organizationMemberships)
          .where(
            and(
              eq(organizationMemberships.organizationId, grant.organizationId),
              eq(organizationMemberships.userId, actorUserId),
              eq(organizationMemberships.role, 'organization_owner'),
              eq(organizationMemberships.active, true),
            ),
          )
          .limit(1)
          .then((rows) => rows[0]);
        if (!(await isProvider(transaction, actorUserId)) && !owner)
          throw new SupportAccessError(
            'SUPPORT_ACCESS_DENIED',
            'Provider or organization-owner access is required.',
          );
        if (grant.status === 'revoked' || grant.status === 'expired')
          return view(grant);
        const [revoked] = await transaction
          .update(supportGrants)
          .set({ status: 'revoked', revokedAt: now() })
          .where(eq(supportGrants.id, grant.id))
          .returning();
        if (!revoked) throw new Error('Support grant revocation failed.');
        await appendEvent(transaction, revoked, actorUserId, 'revoked');
        return view(revoked);
      });
    },
    async listForOrganization(ownerUserId, organizationId) {
      const owner = await database
        .select({ userId: organizationMemberships.userId })
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.organizationId, organizationId),
            eq(organizationMemberships.userId, ownerUserId),
            eq(organizationMemberships.role, 'organization_owner'),
            eq(organizationMemberships.active, true),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);
      if (!owner)
        throw new SupportAccessError(
          'SUPPORT_ACCESS_DENIED',
          'Organization-owner access is required.',
        );
      const rows = await database
        .select()
        .from(supportGrants)
        .where(eq(supportGrants.organizationId, organizationId))
        .orderBy(supportGrants.createdAt);
      return rows.map(view);
    },
    async listForProvider(providerUserId) {
      if (!(await isProvider(database, providerUserId)))
        throw new SupportAccessError(
          'SUPPORT_ACCESS_DENIED',
          'Platform administrator access is required.',
        );
      const rows = await database
        .select()
        .from(supportGrants)
        .where(eq(supportGrants.providerUserId, providerUserId))
        .orderBy(supportGrants.createdAt);
      return rows.map(view);
    },
    async authorize(providerUserId, grantId, organizationId) {
      if (!(await isProvider(database, providerUserId)))
        throw new SupportAccessError(
          'SUPPORT_ACCESS_DENIED',
          'Platform administrator access is required.',
        );
      const result = await database.transaction(async (transaction) => {
        const grant = await transaction
          .select()
          .from(supportGrants)
          .where(
            and(
              eq(supportGrants.id, grantId),
              eq(supportGrants.organizationId, organizationId),
              eq(supportGrants.providerUserId, providerUserId),
            ),
          )
          .for('update')
          .limit(1)
          .then((rows) => rows[0]);
        if (!grant)
          throw new SupportAccessError(
            'SUPPORT_GRANT_NOT_FOUND',
            'Support grant is not valid for this organization.',
          );
        if (grant.status !== 'active')
          throw new SupportAccessError(
            'SUPPORT_GRANT_INVALID',
            'This support grant is not active.',
          );
        if (grant.expiresAt <= now()) {
          const [expired] = await transaction
            .update(supportGrants)
            .set({ status: 'expired' })
            .where(eq(supportGrants.id, grant.id))
            .returning();
          if (expired)
            await appendEvent(transaction, expired, providerUserId, 'expired');
          return { grant: view(expired ?? grant), expired: true as const };
        }
        await appendEvent(transaction, grant, providerUserId, 'entry');
        return { grant: view(grant), expired: false as const };
      });
      if (result.expired)
        throw new SupportAccessError(
          'SUPPORT_GRANT_EXPIRED',
          'This support grant has expired.',
        );
      return result.grant;
    },
    async recordOperationalAction(
      providerUserId,
      grantId,
      organizationId,
      action,
    ) {
      if (!(await isProvider(database, providerUserId)))
        throw new SupportAccessError(
          'SUPPORT_ACCESS_DENIED',
          'Platform administrator access is required.',
        );
      await database.transaction(async (transaction) => {
        const grant = await transaction
          .select()
          .from(supportGrants)
          .where(
            and(
              eq(supportGrants.id, grantId),
              eq(supportGrants.organizationId, organizationId),
              eq(supportGrants.providerUserId, providerUserId),
            ),
          )
          .for('update')
          .limit(1)
          .then((rows) => rows[0]);
        if (!grant)
          throw new SupportAccessError(
            'SUPPORT_GRANT_NOT_FOUND',
            'Support grant is not valid for this organization.',
          );
        if (grant.status !== 'active')
          throw new SupportAccessError(
            'SUPPORT_GRANT_INVALID',
            'This support grant is not active.',
          );
        if (grant.expiresAt <= now()) {
          const [expired] = await transaction
            .update(supportGrants)
            .set({ status: 'expired' })
            .where(eq(supportGrants.id, grant.id))
            .returning();
          if (expired)
            await appendEvent(transaction, expired, providerUserId, 'expired');
          throw new SupportAccessError(
            'SUPPORT_GRANT_EXPIRED',
            'This support grant has expired.',
          );
        }
        await appendEvent(
          transaction,
          grant,
          providerUserId,
          'operational_action',
          action,
        );
      });
    },
  };
}
