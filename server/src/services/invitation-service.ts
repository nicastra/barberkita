import { randomBytes } from 'node:crypto';

import { and, eq, isNull, sql } from 'drizzle-orm';

import type { Database } from '../db/client';
import {
  invitations,
  organizationMemberships,
  onboardingMilestones,
  organizations,
  shopMemberships,
  shops,
  tenantAuditLogs,
  users,
} from '../db/schema';
import { hashToken } from './auth-service';
import type { AuthUser } from './auth-service';

export type InvitationErrorCode = 'INVITATION_FORBIDDEN';

export class InvitationDomainError extends Error {
  public constructor(
    public readonly code: InvitationErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface InvitationView {
  id: string;
  organizationId: string;
  shopId: string;
  email: string;
  organizationRole: typeof invitations.$inferSelect.organizationRole;
  shopRole: typeof invitations.$inferSelect.shopRole;
  status: typeof invitations.$inferSelect.status;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface InvitationService {
  create(
    actor: AuthUser,
    input: {
      organizationId: string;
      shopId: string;
      email: string;
      organizationRole:
        'organization_owner' | 'organization_admin' | 'organization_member';
      shopRole: 'shop_manager' | 'receptionist' | 'barber';
      expiresInHours: number;
    },
  ): Promise<{ invitation: InvitationView; token: string }>;
  list(actor: AuthUser, organizationId: string): Promise<InvitationView[]>;
  revoke(actor: AuthUser, organizationId: string, id: string): Promise<boolean>;
  accept(
    token: string,
    input: { name?: string | undefined; password: string },
  ): Promise<{ userId: string; organizationId: string; shopId: string }>;
}

type InvitationTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

function view(row: typeof invitations.$inferSelect): InvitationView {
  return {
    id: row.id,
    organizationId: row.organizationId,
    shopId: row.shopId,
    email: row.email,
    organizationRole: row.organizationRole,
    shopRole: row.shopRole,
    status: row.status,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

async function addMemberships(
  transaction: InvitationTransaction,
  invitation: typeof invitations.$inferSelect,
  userId: string,
  name: string,
  passwordHash: string,
  active: boolean,
): Promise<void> {
  await transaction
    .insert(users)
    .values({
      id: userId,
      email: invitation.email,
      name,
      passwordHash,
      active,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { name, active, updatedAt: new Date() },
    });
  await transaction
    .insert(organizationMemberships)
    .values({
      organizationId: invitation.organizationId,
      userId,
      role: invitation.organizationRole,
      active: true,
    })
    .onConflictDoUpdate({
      target: [
        organizationMemberships.organizationId,
        organizationMemberships.userId,
      ],
      set: {
        role: invitation.organizationRole,
        active: true,
        updatedAt: new Date(),
      },
    });
  await transaction
    .insert(shopMemberships)
    .values({
      organizationId: invitation.organizationId,
      shopId: invitation.shopId,
      userId,
      role: invitation.shopRole,
      active: true,
    })
    .onConflictDoUpdate({
      target: [shopMemberships.shopId, shopMemberships.userId],
      set: {
        organizationId: invitation.organizationId,
        role: invitation.shopRole,
        active: true,
        updatedAt: new Date(),
      },
    });
  // Keep pre-contraction installations compatible with the legacy audit FK.
  // The table is intentionally probed because it is removed by the guarded
  // Phase 9 contraction migration.
  const legacy = await transaction.execute<{ present: boolean }>(sql`
    select to_regclass('public.staff_users') is not null as present
  `);
  if (legacy[0]?.present) {
    await transaction.execute(sql`
      insert into staff_users
        (id, user_id, shop_id, email, name, password_hash, role, active)
      values
        (${userId}, ${userId}, ${invitation.shopId}, ${invitation.email}, ${name}, ${passwordHash},
         ${invitation.shopRole === 'shop_manager' ? 'owner' : 'staff'}::staff_role, ${active})
      on conflict (id) do update set
        user_id = excluded.user_id,
        shop_id = excluded.shop_id,
        email = excluded.email,
        name = excluded.name,
        password_hash = excluded.password_hash,
        role = excluded.role,
        active = excluded.active,
        updated_at = now()
    `);
  }
}

export function createInvitationService(
  database: Database,
  passwords: { hash(value: string): Promise<string> } = {
    hash: (value) => Bun.password.hash(value),
  },
): InvitationService {
  return {
    async create(actor, input) {
      const authorized = await database
        .select({
          role: organizationMemberships.role,
          lifecycle: organizations.lifecycle,
        })
        .from(organizationMemberships)
        .innerJoin(
          shops,
          eq(shops.organizationId, organizationMemberships.organizationId),
        )
        .innerJoin(
          organizations,
          eq(organizations.id, organizationMemberships.organizationId),
        )
        .where(
          and(
            eq(organizationMemberships.organizationId, input.organizationId),
            eq(organizationMemberships.userId, actor.id),
            eq(organizationMemberships.active, true),
            eq(shops.id, input.shopId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);
      if (
        !authorized ||
        !['trialing', 'active'].includes(authorized.lifecycle) ||
        !['organization_owner', 'organization_admin'].includes(authorized.role)
      )
        throw new InvitationDomainError(
          'INVITATION_FORBIDDEN',
          'Invitation scope is not authorized.',
        );
      if (
        input.organizationRole === 'organization_owner' &&
        authorized.role !== 'organization_owner'
      )
        throw new InvitationDomainError(
          'INVITATION_FORBIDDEN',
          'Only an organization owner may invite an owner.',
        );
      if (
        authorized.role === 'organization_admin' &&
        (input.organizationRole !== 'organization_member' ||
          input.shopRole === 'shop_manager')
      )
        throw new InvitationDomainError(
          'INVITATION_FORBIDDEN',
          'Organization administrators may invite members and staff only.',
        );
      const token = randomBytes(32).toString('base64url');
      const email = input.email.toLowerCase();
      const [row] = await database
        .insert(invitations)
        .values({
          organizationId: input.organizationId,
          shopId: input.shopId,
          email,
          organizationRole: input.organizationRole,
          shopRole: input.shopRole,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + input.expiresInHours * 3_600_000),
          invitedByUserId: actor.id,
        })
        .returning();
      if (!row) throw new Error('Invitation creation failed.');
      await database.insert(tenantAuditLogs).values({
        organizationId: row.organizationId,
        shopId: row.shopId,
        actorUserId: actor.id,
        action: 'invitation_created',
        metadata: { invitationId: row.id, email, shopRole: row.shopRole },
      });
      return { invitation: view(row), token };
    },
    async list(actor, organizationId) {
      const membership = await database
        .select({ role: organizationMemberships.role })
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.organizationId, organizationId),
            eq(organizationMemberships.userId, actor.id),
            eq(organizationMemberships.active, true),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);
      if (
        !membership ||
        !['organization_owner', 'organization_admin'].includes(membership.role)
      )
        throw new InvitationDomainError(
          'INVITATION_FORBIDDEN',
          'Organization administrator access is required.',
        );
      const rows = await database
        .select()
        .from(invitations)
        .where(eq(invitations.organizationId, organizationId))
        .orderBy(invitations.createdAt);
      return rows.map(view);
    },
    async revoke(actor, organizationId, id) {
      const membership = await database
        .select({ role: organizationMemberships.role })
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.organizationId, organizationId),
            eq(organizationMemberships.userId, actor.id),
            eq(organizationMemberships.active, true),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);
      if (
        !membership ||
        !['organization_owner', 'organization_admin'].includes(membership.role)
      )
        throw new InvitationDomainError(
          'INVITATION_FORBIDDEN',
          'Organization administrator access is required.',
        );
      const [row] = await database
        .update(invitations)
        .set({ status: 'revoked', revokedAt: new Date() })
        .where(
          and(
            eq(invitations.id, id),
            eq(invitations.organizationId, organizationId),
            eq(invitations.status, 'pending'),
          ),
        )
        .returning();
      if (!row) return false;
      await database.insert(tenantAuditLogs).values({
        organizationId: row.organizationId,
        shopId: row.shopId,
        actorUserId: actor.id,
        action: 'invitation_revoked',
        metadata: { invitationId: row.id },
      });
      return true;
    },
    async accept(token, input) {
      return database.transaction(async (transaction) => {
        const invitation = await transaction
          .select()
          .from(invitations)
          .where(eq(invitations.tokenHash, hashToken(token)))
          .for('update')
          .limit(1)
          .then((rows) => rows[0]);
        if (
          !invitation ||
          invitation.status !== 'pending' ||
          invitation.expiresAt <= new Date()
        )
          throw new Error('Invitation is unavailable.');
        const existing = await transaction
          .select()
          .from(users)
          .where(eq(users.email, invitation.email))
          .limit(1)
          .then((rows) => rows[0]);
        const userId = existing?.id ?? crypto.randomUUID();
        const name = input.name ?? existing?.name ?? invitation.email;
        const passwordHash =
          existing?.passwordHash ?? (await passwords.hash(input.password));
        await addMemberships(
          transaction,
          invitation,
          userId,
          name,
          passwordHash,
          existing?.active ?? true,
        );
        const [accepted] = await transaction
          .update(invitations)
          .set({ status: 'accepted', acceptedAt: new Date() })
          .where(
            and(
              eq(invitations.id, invitation.id),
              eq(invitations.status, 'pending'),
              isNull(invitations.acceptedAt),
            ),
          )
          .returning({ id: invitations.id });
        if (!accepted) throw new Error('Invitation is unavailable.');
        await transaction.insert(tenantAuditLogs).values({
          organizationId: invitation.organizationId,
          shopId: invitation.shopId,
          actorUserId: userId,
          action: 'invitation_accepted',
          metadata: { invitationId: invitation.id },
        });
        if (invitation.organizationRole === 'organization_owner') {
          await transaction
            .insert(onboardingMilestones)
            .values({
              organizationId: invitation.organizationId,
              shopId: invitation.shopId,
              milestone: 'owner_activated',
              completedByUserId: userId,
            })
            .onConflictDoNothing({
              target: [
                onboardingMilestones.shopId,
                onboardingMilestones.milestone,
              ],
            });
          await transaction.insert(tenantAuditLogs).values({
            organizationId: invitation.organizationId,
            shopId: invitation.shopId,
            actorUserId: userId,
            action: 'owner_activated',
            metadata: { invitationId: invitation.id },
          });
        }
        return {
          userId,
          organizationId: invitation.organizationId,
          shopId: invitation.shopId,
        };
      });
    },
  };
}
