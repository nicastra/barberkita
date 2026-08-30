import { createHash, randomBytes } from 'node:crypto';

import { and, eq, gt, sql } from 'drizzle-orm';

import type { Database } from '../db/client';
import { auditLogs, sessions, shops, staffUsers } from '../db/schema';

export interface AuthUser {
  id: string;
  shopId: string;
  name: string;
  email: string;
  role: 'owner' | 'staff';
}

export interface AuthService {
  setupOwner(input: {
    name: string;
    email: string;
    password: string;
    shop: {
      name: string;
      phone: string;
      email: string;
      address: string;
      timezone: string;
    };
  }): Promise<{ user: AuthUser; shop: typeof shops.$inferSelect } | null>;
  signIn(
    email: string,
    password: string,
  ): Promise<{ user: AuthUser; token: string } | null>;
  signOut(token: string): Promise<void>;
  getUser(token: string): Promise<AuthUser | null>;
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

const passwordService: PasswordService = {
  hash: (value) => Bun.password.hash(value),
  verify: (value, hash) => Bun.password.verify(value, hash),
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toUser(row: typeof staffUsers.$inferSelect): AuthUser {
  return {
    id: row.id,
    shopId: row.shopId,
    name: row.name,
    email: row.email,
    role: row.role,
  };
}

export function createAuthService(
  database: Database,
  passwords: PasswordService = passwordService,
): AuthService {
  return {
    async setupOwner(input) {
      return database.transaction(async (transaction) => {
        const [countRow] = await transaction
          .select({ count: sql<number>`count(*)` })
          .from(staffUsers);
        if (Number(countRow?.count ?? 0) > 0) return null;
        const [shop] = await transaction
          .insert(shops)
          .values(input.shop)
          .returning();
        if (!shop) throw new Error('Shop setup failed.');
        const [row] = await transaction
          .insert(staffUsers)
          .values({
            shopId: shop.id,
            name: input.name,
            email: input.email.toLowerCase(),
            passwordHash: await passwords.hash(input.password),
            role: 'owner',
          })
          .returning();
        if (!row) throw new Error('Owner setup failed.');
        await transaction.insert(auditLogs).values({
          actorStaffUserId: row.id,
          action: 'owner_setup',
          entityType: 'shop',
          entityId: shop.id,
        });
        return { user: toUser(row), shop };
      });
    },
    async signIn(email, password) {
      const row = await database
        .select()
        .from(staffUsers)
        .where(eq(staffUsers.email, email.toLowerCase()))
        .limit(1)
        .then((rows) => rows[0]);
      if (
        !row ||
        !row.active ||
        !(await passwords.verify(password, row.passwordHash))
      )
        return null;
      const token = randomBytes(32).toString('base64url');
      await database.insert(sessions).values({
        staffUserId: row.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      });
      await database.insert(auditLogs).values({
        actorStaffUserId: row.id,
        action: 'signed_in',
        entityType: 'session',
      });
      return { user: toUser(row), token };
    },
    async signOut(token) {
      const hash = hashToken(token);
      const session = await database
        .select({ userId: sessions.staffUserId })
        .from(sessions)
        .where(eq(sessions.tokenHash, hash))
        .limit(1)
        .then((rows) => rows[0]);
      await database.delete(sessions).where(eq(sessions.tokenHash, hash));
      if (session)
        await database.insert(auditLogs).values({
          actorStaffUserId: session.userId,
          action: 'signed_out',
          entityType: 'session',
        });
    },
    async getUser(token) {
      const row = await database
        .select({ user: staffUsers })
        .from(sessions)
        .innerJoin(staffUsers, eq(sessions.staffUserId, staffUsers.id))
        .where(
          and(
            eq(sessions.tokenHash, hashToken(token)),
            gt(sessions.expiresAt, new Date()),
            eq(staffUsers.active, true),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);
      return row ? toUser(row.user) : null;
    },
    async createStaff(actor, input) {
      const [row] = await database
        .insert(staffUsers)
        .values({
          shopId: actor.shopId,
          name: input.name,
          email: input.email.toLowerCase(),
          passwordHash: await passwords.hash(input.password),
          role: input.role,
        })
        .returning();
      if (!row) throw new Error('Staff creation failed.');
      await database.insert(auditLogs).values({
        actorStaffUserId: actor.id,
        action: 'staff_created',
        entityType: 'staff_user',
        entityId: row.id,
      });
      return toUser(row);
    },
    async listStaff(actor) {
      const rows = await database
        .select()
        .from(staffUsers)
        .where(eq(staffUsers.shopId, actor.shopId));
      return rows.map(toUser);
    },
    async updateStaff(actor, id, input) {
      const existing = await database
        .select()
        .from(staffUsers)
        .where(and(eq(staffUsers.id, id), eq(staffUsers.shopId, actor.shopId)))
        .limit(1)
        .then((rows) => rows[0]);
      if (!existing) return null;
      const update: Partial<typeof staffUsers.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.name !== undefined) update.name = input.name;
      if (input.email !== undefined) update.email = input.email.toLowerCase();
      if (input.role !== undefined) update.role = input.role;
      if (input.active !== undefined) update.active = input.active;
      if (input.password !== undefined)
        update.passwordHash = await passwords.hash(input.password);
      const [row] = await database
        .update(staffUsers)
        .set(update)
        .where(eq(staffUsers.id, id))
        .returning();
      if (!row) return null;
      await database.insert(auditLogs).values({
        actorStaffUserId: actor.id,
        action: 'staff_updated',
        entityType: 'staff_user',
        entityId: id,
      });
      return toUser(row);
    },
    async deleteStaff(actor, id) {
      if (id === actor.id) return false;
      const result = await database
        .delete(staffUsers)
        .where(and(eq(staffUsers.id, id), eq(staffUsers.shopId, actor.shopId)))
        .returning({ id: staffUsers.id });
      if (result.length)
        await database.insert(auditLogs).values({
          actorStaffUserId: actor.id,
          action: 'staff_deleted',
          entityType: 'staff_user',
          entityId: id,
        });
      return result.length > 0;
    },
  };
}

export { hashToken };
