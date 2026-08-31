import { and, asc, eq, ilike, or } from 'drizzle-orm';

import type { Database } from '../db/client';
import { auditLogs, customers } from '../db/schema';
import type { AuthUser } from './auth-service';

export type CustomerInput = {
  name: string;
  phone: string;
  email: string | null;
  notes: string;
};

type CustomerUpdate = {
  [Key in keyof CustomerInput]?: CustomerInput[Key] | undefined;
};

export class CustomerConflictError extends Error {}

export interface CustomerService {
  list(
    shopId: string,
    search?: string | undefined,
  ): Promise<(typeof customers.$inferSelect)[]>;
  get(
    shopId: string,
    id: string,
  ): Promise<typeof customers.$inferSelect | null>;
  create(
    shopId: string,
    input: CustomerInput,
    actorStaffUserId?: string | undefined,
  ): Promise<{ customer: typeof customers.$inferSelect; created: boolean }>;
  update(
    actor: AuthUser,
    id: string,
    input: CustomerUpdate,
  ): Promise<typeof customers.$inferSelect | null>;
}

export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

function normalizeInput(input: CustomerInput): CustomerInput {
  return {
    name: input.name.trim(),
    phone: normalizePhone(input.phone),
    email: input.email?.trim().toLowerCase() || null,
    notes: input.notes.trim(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

export function createCustomerService(database: Database): CustomerService {
  return {
    async list(shopId, search) {
      const query = search?.trim();
      if (!query)
        return database
          .select()
          .from(customers)
          .where(eq(customers.shopId, shopId))
          .orderBy(asc(customers.name));
      const escaped = query.replace(/[\\%_]/g, '\\$&');
      const normalizedPhone = normalizePhone(query);
      return database
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.shopId, shopId),
            or(
              ilike(customers.name, `%${escaped}%`),
              ilike(customers.email, `%${escaped}%`),
              ilike(customers.phone, `%${normalizedPhone || escaped}%`),
            ),
          ),
        )
        .orderBy(asc(customers.name));
    },
    async get(shopId, id) {
      return database
        .select()
        .from(customers)
        .where(and(eq(customers.id, id), eq(customers.shopId, shopId)))
        .limit(1)
        .then((rows) => rows[0] ?? null);
    },
    async create(shopId, input, actorStaffUserId) {
      const normalized = normalizeInput(input);
      const [customer] = await database
        .insert(customers)
        .values({ shopId, ...normalized })
        .onConflictDoNothing({
          target: [customers.shopId, customers.phone],
        })
        .returning();
      if (customer) {
        await database.insert(auditLogs).values({
          actorStaffUserId: actorStaffUserId ?? null,
          action: 'customer_created',
          entityType: 'customer',
          entityId: customer.id,
        });
        return { customer, created: true };
      }
      const existing = await database
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.shopId, shopId),
            eq(customers.phone, normalized.phone),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);
      if (!existing) throw new Error('Customer creation failed.');
      return { customer: existing, created: false };
    },
    async update(actor, id, input) {
      const update: Partial<typeof customers.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.name !== undefined) update.name = input.name.trim();
      if (input.phone !== undefined) update.phone = normalizePhone(input.phone);
      if (input.email !== undefined)
        update.email = input.email?.trim().toLowerCase() || null;
      if (input.notes !== undefined) update.notes = input.notes.trim();
      try {
        const [customer] = await database
          .update(customers)
          .set(update)
          .where(and(eq(customers.id, id), eq(customers.shopId, actor.shopId)))
          .returning();
        if (!customer) return null;
        await database.insert(auditLogs).values({
          actorStaffUserId: actor.id,
          action: 'customer_updated',
          entityType: 'customer',
          entityId: id,
        });
        return customer;
      } catch (error) {
        if (isUniqueViolation(error))
          throw new CustomerConflictError(
            'A customer with that phone number already exists.',
          );
        throw error;
      }
    },
  };
}
