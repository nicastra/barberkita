import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import {
  auditLogs,
  organizationMemberships,
  organizations,
  platformAdmins,
  sessions,
  shopMemberships,
  shops,
  users,
} from '../db/schema';
import type { TenantContext } from './tenant-service';
import { auditScope } from './audit-scope';

export interface AuthUser {
  id: string;
  shopId: string;
  name: string;
  email: string;
  role: 'owner' | 'staff';
  tenant?: TenantContext;
}
export interface AuthService {
  signIn(
    email: string,
    password: string,
  ): Promise<{ user: AuthUser; token: string } | null>;
  signOut(token: string): Promise<void>;
  getUser(token: string): Promise<AuthUser | null>;
  reauthenticate?(token: string, password: string): Promise<boolean>;
  hasRecentReauthentication?(
    token: string,
    maxAgeMs?: number,
  ): Promise<boolean>;
  switchShop?(token: string, shopId: string): Promise<AuthUser | null>;
  createStaff(
    actor: AuthUser,
    input: {
      name: string;
      email: string;
      password: string;
      role: 'owner' | 'staff';
    },
  ): Promise<AuthUser>;
  listStaff(actor: AuthUser): Promise<AuthUser[]>;
  updateStaff(
    actor: AuthUser,
    id: string,
    input: {
      name?: string | undefined;
      email?: string | undefined;
      password?: string | undefined;
      role?: 'owner' | 'staff' | undefined;
      active?: boolean | undefined;
    },
  ): Promise<AuthUser | null>;
  deleteStaff(actor: AuthUser, id: string): Promise<boolean>;
}
interface PasswordService {
  hash(value: string): Promise<string>;
  verify(value: string, hash: string): Promise<boolean>;
}
export type AuthErrorCode =
  | 'FORBIDDEN'
  | 'STAFF_EMAIL_CONFLICT'
  | 'LAST_OWNER_REQUIRED'
  | 'REAUTHENTICATION_REQUIRED';
export class AuthDomainError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
    public readonly status: 403 | 409,
  ) {
    super(message);
  }
}
const passwordService: PasswordService = {
  hash: (v) => Bun.password.hash(v),
  verify: (v, h) => Bun.password.verify(v, h),
};
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
function hasDatabaseCode(error: unknown, code: string): boolean {
  let current: unknown = error;
  for (let i = 0; i < 4; i += 1) {
    if (
      typeof current === 'object' &&
      current !== null &&
      'code' in current &&
      current.code === code
    )
      return true;
    current =
      typeof current === 'object' && current !== null && 'cause' in current
        ? current.cause
        : null;
  }
  return false;
}
type AuthTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];
function toUser(
  row: typeof users.$inferSelect,
  shopId: string,
  role: 'owner' | 'staff',
): AuthUser {
  return { id: row.id, shopId, name: row.name, email: row.email, role };
}
function assertOwner(actor: AuthUser): void {
  if (actor.role !== 'owner')
    throw new AuthDomainError('FORBIDDEN', 'Owner access is required.', 403);
}
async function membershipFor(
  db: Database | AuthTransaction,
  userId: string,
  shopId?: string,
) {
  return db
    .select({
      shopId: shops.id,
      organizationRole: organizationMemberships.role,
      shopRole: shopMemberships.role,
      organizationId: organizations.id,
    })
    .from(shopMemberships)
    .innerJoin(shops, eq(shopMemberships.shopId, shops.id))
    .innerJoin(organizations, eq(shops.organizationId, organizations.id))
    .innerJoin(
      organizationMemberships,
      and(
        eq(organizationMemberships.organizationId, organizations.id),
        eq(organizationMemberships.userId, userId),
      ),
    )
    .where(
      and(
        eq(shopMemberships.userId, userId),
        eq(shopMemberships.active, true),
        eq(organizationMemberships.active, true),
        inArray(organizations.lifecycle, ['trialing', 'active', 'suspended']),
        shopId ? eq(shops.id, shopId) : sql`true`,
      ),
    )
    .orderBy(shops.createdAt)
    .limit(1)
    .then((r) => r[0]);
}
async function activeOwnerCount(
  tx: AuthTransaction,
  organizationId: string,
): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)` })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.role, 'organization_owner'),
        eq(organizationMemberships.active, true),
      ),
    );
  return Number(row?.count ?? 0);
}
async function lockShop(tx: AuthTransaction, shopId: string): Promise<void> {
  await tx
    .select({ id: shops.id })
    .from(shops)
    .where(eq(shops.id, shopId))
    .for('update')
    .limit(1);
}

export function createAuthService(
  database: Database,
  passwords: PasswordService = passwordService,
): AuthService {
  return {
    async signIn(email, password) {
      const global = await database
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1)
        .then((r) => r[0]);
      if (
        !global ||
        !global.active ||
        !(await passwords.verify(password, global.passwordHash))
      ) {
        await database.insert(auditLogs).values({
          action: 'sign_in_failed',
          entityType: 'session',
          metadata: { identifier: email.toLowerCase() },
        });
        return null;
      }
      const membership = await membershipFor(database, global.id);
      const isPlatform = Boolean(
        await database
          .select({ userId: platformAdmins.userId })
          .from(platformAdmins)
          .where(eq(platformAdmins.userId, global.id))
          .limit(1),
      );
      if (!membership && !isPlatform) return null;
      const token = randomBytes(32).toString('base64url');
      await database.insert(sessions).values({
        userId: global.id,
        activeShopId: membership?.shopId ?? null,
        reauthenticatedAt: new Date(),
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      });
      await database.insert(auditLogs).values({
        ...auditScope({
          id: global.id,
          shopId: membership?.shopId ?? '',
          name: global.name,
          email: global.email,
          role: 'staff',
          ...(membership
            ? {
                tenant: {
                  userId: global.id,
                  organizationId: membership.organizationId,
                  shopId: membership.shopId,
                  organizationRole: membership.organizationRole,
                  shopRole: membership.shopRole,
                  organizationLifecycle: 'active' as const,
                },
              }
            : {}),
        }),
        actorStaffUserId: global.id,
        action: 'signed_in',
        entityType: 'session',
        entityId: membership?.shopId ?? null,
        shopId: membership?.shopId ?? null,
        organizationId: membership?.organizationId ?? null,
      });
      return {
        user: toUser(
          global,
          membership?.shopId ?? '',
          membership &&
            (membership.organizationRole === 'organization_owner' ||
              membership.shopRole === 'shop_manager')
            ? 'owner'
            : 'staff',
        ),
        token,
      };
    },
    async signOut(token) {
      const hash = hashToken(token);
      const session = await database
        .select({ userId: sessions.userId })
        .from(sessions)
        .where(eq(sessions.tokenHash, hash))
        .limit(1)
        .then((r) => r[0]);
      await database.delete(sessions).where(eq(sessions.tokenHash, hash));
      if (session?.userId)
        await database.insert(auditLogs).values({
          shopId: null,
          organizationId: null,
          actorStaffUserId: session.userId,
          action: 'signed_out',
          entityType: 'session',
        });
    },
    async reauthenticate(token, password) {
      const session = await database
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.tokenHash, hashToken(token)),
            gt(sessions.expiresAt, new Date()),
          ),
        )
        .limit(1)
        .then((r) => r[0]);
      if (!session?.userId) return false;
      const user = await database
        .select()
        .from(users)
        .where(and(eq(users.id, session.userId), eq(users.active, true)))
        .limit(1)
        .then((r) => r[0]);
      const valid = Boolean(
        user && (await passwords.verify(password, user.passwordHash)),
      );
      await database.insert(auditLogs).values({
        shopId: null,
        organizationId: null,
        actorStaffUserId: session.userId,
        action: valid ? 'reauthenticated' : 'reauthentication_failed',
        entityType: 'session',
      });
      if (!valid) return false;
      await database
        .update(sessions)
        .set({ reauthenticatedAt: new Date() })
        .where(eq(sessions.id, session.id));
      return true;
    },
    async hasRecentReauthentication(token, maxAgeMs = 15 * 60_000) {
      const session = await database
        .select({ reauthenticatedAt: sessions.reauthenticatedAt })
        .from(sessions)
        .where(
          and(
            eq(sessions.tokenHash, hashToken(token)),
            gt(sessions.expiresAt, new Date()),
          ),
        )
        .limit(1)
        .then((r) => r[0]);
      return Boolean(
        session?.reauthenticatedAt &&
        Date.now() - session.reauthenticatedAt.getTime() <= maxAgeMs,
      );
    },
    async getUser(token) {
      const session = await database
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.tokenHash, hashToken(token)),
            gt(sessions.expiresAt, new Date()),
          ),
        )
        .limit(1)
        .then((r) => r[0]);
      if (!session?.userId) return null;
      const user = await database
        .select()
        .from(users)
        .where(and(eq(users.id, session.userId), eq(users.active, true)))
        .limit(1)
        .then((r) => r[0]);
      if (!user) return null;
      let membership = await membershipFor(
        database,
        user.id,
        session.activeShopId ?? undefined,
      );
      // If a branch was removed while the session was active, keep the
      // global session usable by selecting the user's next authorized branch.
      // A user with no remaining memberships is still rejected below.
      if (!membership && session.activeShopId) {
        membership = await membershipFor(database, user.id);
        if (membership)
          await database
            .update(sessions)
            .set({ activeShopId: membership.shopId })
            .where(eq(sessions.id, session.id));
      }
      const isPlatform = Boolean(
        await database
          .select({ userId: platformAdmins.userId })
          .from(platformAdmins)
          .where(eq(platformAdmins.userId, user.id))
          .limit(1),
      );
      if (!membership && !isPlatform) return null;
      return toUser(
        user,
        membership?.shopId ?? session.activeShopId ?? '',
        membership &&
          (membership.organizationRole === 'organization_owner' ||
            membership.shopRole === 'shop_manager')
          ? 'owner'
          : 'staff',
      );
    },
    async switchShop(token, shopId) {
      const session = await database
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.tokenHash, hashToken(token)),
            gt(sessions.expiresAt, new Date()),
          ),
        )
        .limit(1)
        .then((r) => r[0]);
      if (!session?.userId) return null;
      const membership = await membershipFor(database, session.userId, shopId);
      if (!membership) {
        // Keep denied branch-switch attempts auditable without persisting an
        // untrusted shop id into the audit foreign key.
        await database.insert(auditLogs).values({
          actorStaffUserId: session.userId,
          action: 'branch_switch_denied',
          entityType: 'shop',
          metadata: { requestedShopId: shopId },
        });
        return null;
      }
      await database
        .update(sessions)
        .set({ activeShopId: shopId })
        .where(eq(sessions.id, session.id));
      const user = await database
        .select()
        .from(users)
        .where(and(eq(users.id, session.userId), eq(users.active, true)))
        .limit(1)
        .then((r) => r[0]);
      if (!user) return null;
      await database.insert(auditLogs).values({
        organizationId: membership.organizationId,
        actorStaffUserId: user.id,
        action: 'branch_switched',
        entityType: 'shop',
        entityId: shopId,
        shopId,
      });
      return toUser(
        user,
        shopId,
        membership.organizationRole === 'organization_owner' ||
          membership.shopRole === 'shop_manager'
          ? 'owner'
          : 'staff',
      );
    },
    async createStaff(actor, input) {
      assertOwner(actor);
      const passwordHash = await passwords.hash(input.password);
      try {
        return await database.transaction(async (tx) => {
          const actorMembership = await membershipFor(
            tx,
            actor.id,
            actor.shopId,
          );
          if (!actorMembership)
            throw new AuthDomainError(
              'FORBIDDEN',
              'Owner access is required.',
              403,
            );
          const [user] = await tx
            .insert(users)
            .values({
              name: input.name,
              email: input.email.toLowerCase(),
              passwordHash,
            })
            .returning();
          if (!user) throw new Error('Staff creation failed.');
          await tx.insert(organizationMemberships).values({
            organizationId: actorMembership.organizationId,
            userId: user.id,
            role:
              input.role === 'owner'
                ? 'organization_owner'
                : 'organization_member',
          });
          await tx.insert(shopMemberships).values({
            organizationId: actorMembership.organizationId,
            shopId: actor.shopId,
            userId: user.id,
            role: input.role === 'owner' ? 'shop_manager' : 'receptionist',
          });
          await tx.insert(auditLogs).values({
            ...auditScope(actor),
            actorStaffUserId: actor.id,
            action: 'staff_created',
            entityType: 'user',
            entityId: user.id,
            organizationId: actorMembership.organizationId,
            shopId: actor.shopId,
          });
          return toUser(user, actor.shopId, input.role);
        });
      } catch (error) {
        if (hasDatabaseCode(error, '23505'))
          throw new AuthDomainError(
            'STAFF_EMAIL_CONFLICT',
            'A staff account already uses this email address.',
            409,
          );
        throw error;
      }
    },
    async listStaff(actor) {
      assertOwner(actor);
      const rows = await database
        .select({
          user: users,
          role: organizationMemberships.role,
          shopRole: shopMemberships.role,
        })
        .from(shopMemberships)
        .innerJoin(users, eq(shopMemberships.userId, users.id))
        .innerJoin(shops, eq(shopMemberships.shopId, shops.id))
        .innerJoin(
          organizationMemberships,
          and(
            eq(organizationMemberships.organizationId, shops.organizationId),
            eq(organizationMemberships.userId, users.id),
          ),
        )
        .where(eq(shopMemberships.shopId, actor.shopId));
      return rows.map((r) =>
        toUser(
          r.user,
          actor.shopId,
          r.role === 'organization_owner' || r.shopRole === 'shop_manager'
            ? 'owner'
            : 'staff',
        ),
      );
    },
    async updateStaff(actor, id, input) {
      assertOwner(actor);
      const passwordHash =
        input.password === undefined
          ? undefined
          : await passwords.hash(input.password);
      try {
        return await database.transaction(async (tx) => {
          const existing = await tx
            .select({
              user: users,
              orgRole: organizationMemberships.role,
              shopRole: shopMemberships.role,
              organizationId: shops.organizationId,
            })
            .from(shopMemberships)
            .innerJoin(users, eq(shopMemberships.userId, users.id))
            .innerJoin(shops, eq(shopMemberships.shopId, shops.id))
            .innerJoin(
              organizationMemberships,
              and(
                eq(
                  organizationMemberships.organizationId,
                  shops.organizationId,
                ),
                eq(organizationMemberships.userId, users.id),
              ),
            )
            .where(
              and(eq(shopMemberships.shopId, actor.shopId), eq(users.id, id)),
            )
            .limit(1)
            .then((r) => r[0]);
          if (!existing) return null;
          const removingOwner =
            existing.orgRole === 'organization_owner' &&
            existing.shopRole === 'shop_manager' &&
            (input.role === 'staff' || input.active === false);
          if (removingOwner) {
            await lockShop(tx, actor.shopId);
            if ((await activeOwnerCount(tx, existing.organizationId!)) <= 1)
              throw new AuthDomainError(
                'LAST_OWNER_REQUIRED',
                'The organization must retain at least one active owner.',
                409,
              );
          }
          const userUpdate: Partial<typeof users.$inferInsert> = {
            updatedAt: new Date(),
          };
          if (input.name !== undefined) userUpdate.name = input.name;
          if (input.email !== undefined)
            userUpdate.email = input.email.toLowerCase();
          if (passwordHash !== undefined)
            userUpdate.passwordHash = passwordHash;
          if (input.active !== undefined) userUpdate.active = input.active;
          const [user] = await tx
            .update(users)
            .set(userUpdate)
            .where(eq(users.id, id))
            .returning();
          if (!user) return null;
          if (input.role !== undefined) {
            await tx
              .update(organizationMemberships)
              .set({
                role:
                  input.role === 'owner'
                    ? 'organization_owner'
                    : 'organization_member',
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(
                    organizationMemberships.organizationId,
                    existing.organizationId!,
                  ),
                  eq(organizationMemberships.userId, id),
                ),
              );
            await tx
              .update(shopMemberships)
              .set({
                role: input.role === 'owner' ? 'shop_manager' : 'receptionist',
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(shopMemberships.shopId, actor.shopId),
                  eq(shopMemberships.userId, id),
                ),
              );
          }
          if (input.active !== undefined)
            await tx
              .update(shopMemberships)
              .set({ active: input.active, updatedAt: new Date() })
              .where(
                and(
                  eq(shopMemberships.shopId, actor.shopId),
                  eq(shopMemberships.userId, id),
                ),
              );
          if (
            passwordHash !== undefined ||
            input.active === false ||
            input.role !== undefined
          )
            await tx.delete(sessions).where(eq(sessions.userId, id));
          await tx.insert(auditLogs).values({
            ...auditScope(actor),
            actorStaffUserId: actor.id,
            action: 'staff_updated',
            entityType: 'user',
            entityId: id,
            organizationId: existing.organizationId,
            shopId: actor.shopId,
          });
          return toUser(
            user,
            actor.shopId,
            input.role ??
              (existing.orgRole === 'organization_owner' ||
              existing.shopRole === 'shop_manager'
                ? 'owner'
                : 'staff'),
          );
        });
      } catch (error) {
        if (hasDatabaseCode(error, '23505'))
          throw new AuthDomainError(
            'STAFF_EMAIL_CONFLICT',
            'A staff account already uses this email address.',
            409,
          );
        throw error;
      }
    },
    async deleteStaff(actor, id) {
      assertOwner(actor);
      if (id === actor.id) return false;
      return database.transaction(async (tx) => {
        const existing = await tx
          .select({
            organizationId: shops.organizationId,
            role: organizationMemberships.role,
            active: organizationMemberships.active,
          })
          .from(organizationMemberships)
          .innerJoin(
            shops,
            eq(shops.organizationId, organizationMemberships.organizationId),
          )
          .where(
            and(
              eq(organizationMemberships.userId, id),
              eq(shops.id, actor.shopId),
            ),
          )
          .limit(1)
          .then((r) => r[0]);
        if (!existing?.organizationId) return false;
        const organizationId = existing.organizationId;
        if (existing.role === 'organization_owner' && existing.active) {
          await lockShop(tx, actor.shopId);
          if ((await activeOwnerCount(tx, organizationId)) <= 1)
            throw new AuthDomainError(
              'LAST_OWNER_REQUIRED',
              'The organization must retain at least one active owner.',
              409,
            );
        }
        await tx
          .update(organizationMemberships)
          .set({ active: false, updatedAt: new Date() })
          .where(
            and(
              eq(organizationMemberships.organizationId, organizationId),
              eq(organizationMemberships.userId, id),
            ),
          );
        await tx
          .update(shopMemberships)
          .set({ active: false, updatedAt: new Date() })
          .where(
            and(
              eq(shopMemberships.shopId, actor.shopId),
              eq(shopMemberships.userId, id),
            ),
          );
        await tx.delete(sessions).where(eq(sessions.userId, id));
        await tx.insert(auditLogs).values({
          ...auditScope(actor),
          actorStaffUserId: actor.id,
          action: 'staff_deleted',
          entityType: 'user',
          entityId: id,
          organizationId,
          shopId: actor.shopId,
        });
        return true;
      });
    },
  };
}
export { hashToken };
