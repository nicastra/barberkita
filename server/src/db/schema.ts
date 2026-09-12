import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  integer,
  index,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const systemMetadata = pgTable('system_metadata', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const organizationLifecycle = pgEnum('organization_lifecycle', [
  'trialing',
  'active',
  'suspended',
  'archived',
]);

/** Commercial state captured at the point an organization is approved. */
export const subscriptionStatus = pgEnum('subscription_status', [
  'trialing',
  'active',
  'suspended',
  'archived',
]);

export const organizationRole = pgEnum('organization_role', [
  'organization_owner',
  'organization_admin',
  'organization_member',
]);

export const shopRole = pgEnum('shop_role', [
  'shop_manager',
  'receptionist',
  'barber',
]);

export const invitationStatus = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'revoked',
]);

export const supportGrantStatus = pgEnum('support_grant_status', [
  'pending_approval',
  'active',
  'revoked',
  'expired',
]);

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    lifecycle: organizationLifecycle('lifecycle').notNull().default('trialing'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('organizations_slug_unique').on(table.slug),
    index('organizations_lifecycle_idx').on(table.lifecycle),
    pgPolicy('organizations_tenant_context', {
      using: sql`current_setting('cukurpro.organization_id', true) = '' or ${table.id}::text = current_setting('cukurpro.organization_id', true)`,
    }),
  ],
).enableRLS();

/** Global login identities shared across organizations and branches. */
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
);

export const organizationMemberships = pgTable(
  'organization_memberships',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: organizationRole('role').notNull().default('organization_member'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.userId] }),
    index('organization_memberships_user_id_idx').on(table.userId),
    index('organization_memberships_org_role_idx').on(
      table.organizationId,
      table.role,
    ),
  ],
);

export const platformAdmins = pgTable('platform_admins', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Time-limited provider access; this never creates tenant membership. */
export const supportGrants = pgTable(
  'support_grants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    providerUserId: uuid('provider_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    requestedByUserId: uuid('requested_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reason: text('reason').notNull(),
    status: supportGrantStatus('status').notNull().default('pending_approval'),
    breakGlass: boolean('break_glass').notNull().default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('support_grants_organization_status_idx').on(
      table.organizationId,
      table.status,
      table.expiresAt,
    ),
    index('support_grants_provider_status_idx').on(
      table.providerUserId,
      table.status,
      table.expiresAt,
    ),
  ],
);

/** Append-only support access history. */
export const supportGrantEvents = pgTable(
  'support_grant_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    grantId: uuid('grant_id')
      .notNull()
      .references(() => supportGrants.id, { onDelete: 'restrict' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    reason: text('reason'),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('support_grant_events_grant_created_idx').on(
      table.grantId,
      table.createdAt,
    ),
    index('support_grant_events_organization_created_idx').on(
      table.organizationId,
      table.createdAt,
    ),
  ],
);

/** One current subscription record per organization. Plan enforcement follows in Phase 11. */
export const organizationSubscriptions = pgTable(
  'organization_subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    status: subscriptionStatus('status').notNull().default('trialing'),
    trialStartedAt: timestamp('trial_started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('organization_subscriptions_organization_unique').on(
      table.organizationId,
    ),
    index('organization_subscriptions_status_idx').on(table.status),
  ],
);

export const shops = pgTable(
  'shops',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'restrict',
    }),
    /** Branch slug used by the public storefront; nullable during migration. */
    slug: text('slug'),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    email: text('email').notNull(),
    address: text('address').notNull(),
    timezone: text('timezone').notNull().default('Asia/Jakarta'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('shops_organization_id_idx').on(table.organizationId),
    uniqueIndex('shops_organization_id_id_unique').on(
      table.organizationId,
      table.id,
    ),
    uniqueIndex('shops_slug_unique').on(table.slug),
    pgPolicy('shops_tenant_context', {
      using: sql`current_setting('cukurpro.shop_id', true) = '' or ${table.id}::text = current_setting('cukurpro.shop_id', true)`,
    }),
  ],
).enableRLS();

export const shopMemberships = pgTable(
  'shop_memberships',
  {
    organizationId: uuid('organization_id'),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: shopRole('role').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.shopId, table.userId] }),
    index('shop_memberships_organization_id_idx').on(table.organizationId),
    index('shop_memberships_user_id_idx').on(table.userId),
    index('shop_memberships_shop_role_idx').on(table.shopId, table.role),
    foreignKey({
      columns: [table.organizationId, table.shopId],
      foreignColumns: [shops.organizationId, shops.id],
      name: 'shop_memberships_organization_shop_fk',
    }),
    foreignKey({
      columns: [table.organizationId, table.userId],
      foreignColumns: [
        organizationMemberships.organizationId,
        organizationMemberships.userId,
      ],
      name: 'shop_memberships_organization_user_fk',
    }),
  ],
);

export const tenantAuditLogs = pgTable(
  'tenant_audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    shopId: uuid('shop_id').references(() => shops.id, {
      onDelete: 'set null',
    }),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    reason: text('reason'),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('tenant_audit_logs_org_created_idx').on(
      table.organizationId,
      table.createdAt,
    ),
    index('tenant_audit_logs_shop_created_idx').on(
      table.shopId,
      table.createdAt,
    ),
    index('tenant_audit_logs_actor_created_idx').on(
      table.actorUserId,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.organizationId, table.shopId],
      foreignColumns: [shops.organizationId, shops.id],
      name: 'tenant_audit_logs_organization_shop_fk',
    }),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    activeShopId: uuid('active_shop_id').references(() => shops.id, {
      onDelete: 'set null',
    }),
    reauthenticatedAt: timestamp('reauthenticated_at', {
      withTimezone: true,
    }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

/** One-time, hashed invitation credentials for organization membership. */
export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    email: text('email').notNull(),
    organizationRole: organizationRole('organization_role')
      .notNull()
      .default('organization_member'),
    shopRole: shopRole('shop_role').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    status: invitationStatus('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    invitedByUserId: uuid('invited_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('invitations_org_status_idx').on(
      table.organizationId,
      table.status,
      table.createdAt,
    ),
    index('invitations_email_idx').on(table.email),
    foreignKey({
      columns: [table.organizationId, table.shopId],
      foreignColumns: [shops.organizationId, shops.id],
      name: 'invitations_organization_shop_fk',
    }),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    shopId: uuid('shop_id').references(() => shops.id, {
      onDelete: 'set null',
    }),
    actorStaffUserId: uuid('actor_staff_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.shopId],
      foreignColumns: [shops.organizationId, shops.id],
      name: 'audit_logs_organization_shop_fk',
    }),
  ],
);

export const services = pgTable(
  'services',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    durationMinutes: integer('duration_minutes').notNull(),
    priceRupiah: integer('price_rupiah').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('services_shop_id_idx').on(table.shopId),
    uniqueIndex('services_id_shop_unique').on(table.id, table.shopId),
    check('services_duration_positive', sql`${table.durationMinutes} > 0`),
    check('services_price_nonnegative', sql`${table.priceRupiah} >= 0`),
    pgPolicy('services_tenant_context', {
      using: sql`current_setting('cukurpro.shop_id', true) = '' or ${table.shopId}::text = current_setting('cukurpro.shop_id', true)`,
    }),
  ],
).enableRLS();

/** Durable, idempotent onboarding checkpoints derived from tenant state. */
export const onboardingMilestones = pgTable(
  'onboarding_milestones',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    milestone: text('milestone').notNull(),
    completedByUserId: uuid('completed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    completedAt: timestamp('completed_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('onboarding_milestones_shop_milestone_unique').on(
      table.shopId,
      table.milestone,
    ),
    index('onboarding_milestones_organization_idx').on(table.organizationId),
  ],
);

export const barberProfiles = pgTable(
  'barber_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    staffUserId: uuid('staff_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('barber_profiles_shop_id_idx').on(table.shopId),
    uniqueIndex('barber_profiles_id_shop_unique').on(table.id, table.shopId),
    uniqueIndex('barber_profiles_staff_user_id_unique').on(table.staffUserId),
    pgPolicy('barber_profiles_tenant_context', {
      using: sql`current_setting('cukurpro.shop_id', true) = '' or ${table.shopId}::text = current_setting('cukurpro.shop_id', true)`,
    }),
  ],
).enableRLS();

export const barberServices = pgTable(
  'barber_services',
  {
    shopId: uuid('shop_id').references(() => shops.id, {
      onDelete: 'restrict',
    }),
    barberId: uuid('barber_id')
      .notNull()
      .references(() => barberProfiles.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.barberId, table.serviceId] }),
    index('barber_services_shop_id_idx').on(table.shopId),
    index('barber_services_service_id_idx').on(table.serviceId),
    foreignKey({
      columns: [table.shopId, table.barberId],
      foreignColumns: [barberProfiles.shopId, barberProfiles.id],
      name: 'barber_services_shop_barber_fk',
    }),
    foreignKey({
      columns: [table.shopId, table.serviceId],
      foreignColumns: [services.shopId, services.id],
      name: 'barber_services_shop_service_fk',
    }),
  ],
);

export const barberWorkingHours = pgTable(
  'barber_working_hours',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id').references(() => shops.id, {
      onDelete: 'restrict',
    }),
    barberId: uuid('barber_id')
      .notNull()
      .references(() => barberProfiles.id, { onDelete: 'cascade' }),
    dayOfWeek: smallint('day_of_week').notNull(),
    startMinute: smallint('start_minute').notNull(),
    endMinute: smallint('end_minute').notNull(),
  },
  (table) => [
    index('barber_working_hours_shop_id_idx').on(table.shopId),
    index('barber_working_hours_barber_day_idx').on(
      table.barberId,
      table.dayOfWeek,
    ),
    check(
      'barber_working_hours_day_range',
      sql`${table.dayOfWeek} >= 0 and ${table.dayOfWeek} <= 6`,
    ),
    check(
      'barber_working_hours_time_range',
      sql`${table.startMinute} >= 0 and ${table.endMinute} <= 1440 and ${table.startMinute} < ${table.endMinute}`,
    ),
  ],
);

export const barberBreaks = pgTable(
  'barber_breaks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id').references(() => shops.id, {
      onDelete: 'restrict',
    }),
    barberId: uuid('barber_id')
      .notNull()
      .references(() => barberProfiles.id, { onDelete: 'cascade' }),
    dayOfWeek: smallint('day_of_week').notNull(),
    startMinute: smallint('start_minute').notNull(),
    endMinute: smallint('end_minute').notNull(),
  },
  (table) => [
    index('barber_breaks_shop_id_idx').on(table.shopId),
    index('barber_breaks_barber_day_idx').on(table.barberId, table.dayOfWeek),
    check(
      'barber_breaks_day_range',
      sql`${table.dayOfWeek} >= 0 and ${table.dayOfWeek} <= 6`,
    ),
    check(
      'barber_breaks_time_range',
      sql`${table.startMinute} >= 0 and ${table.endMinute} <= 1440 and ${table.startMinute} < ${table.endMinute}`,
    ),
  ],
);

export const scheduleExceptionKind = pgEnum('schedule_exception_kind', [
  'available',
  'unavailable',
]);

export const barberScheduleExceptions = pgTable(
  'barber_schedule_exceptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id').references(() => shops.id, {
      onDelete: 'restrict',
    }),
    barberId: uuid('barber_id')
      .notNull()
      .references(() => barberProfiles.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    kind: scheduleExceptionKind('kind').notNull(),
    startMinute: smallint('start_minute'),
    endMinute: smallint('end_minute'),
    note: text('note').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('barber_schedule_exceptions_shop_id_idx').on(table.shopId),
    index('barber_schedule_exceptions_barber_date_idx').on(
      table.barberId,
      table.date,
    ),
    check(
      'barber_schedule_exceptions_time_pair',
      sql`(${table.startMinute} is null and ${table.endMinute} is null) or (${table.startMinute} >= 0 and ${table.endMinute} <= 1440 and ${table.startMinute} < ${table.endMinute})`,
    ),
  ],
);

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('customers_shop_name_idx').on(table.shopId, table.name),
    uniqueIndex('customers_shop_phone_unique').on(table.shopId, table.phone),
    uniqueIndex('customers_id_shop_unique').on(table.id, table.shopId),
    pgPolicy('customers_tenant_context', {
      using: sql`current_setting('cukurpro.shop_id', true) = '' or ${table.shopId}::text = current_setting('cukurpro.shop_id', true)`,
    }),
  ],
).enableRLS();

export const bookingStatus = pgEnum('booking_status', [
  'initial',
  'confirmed',
  'rescheduled',
  'checked_in',
  'in_service',
  'completed',
  'cancelled',
  'no_show',
]);

export const bookingSource = pgEnum('booking_source', [
  'staff',
  'public',
  'walk_in',
]);

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    barberId: uuid('barber_id')
      .notNull()
      .references(() => barberProfiles.id, { onDelete: 'restrict' }),
    createdByStaffUserId: uuid('created_by_staff_user_id').references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    status: bookingStatus('status').notNull().default('initial'),
    source: bookingSource('source').notNull(),
    confirmationCode: text('confirmation_code').notNull().unique(),
    notes: text('notes').notNull().default(''),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    noShowAt: timestamp('no_show_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('bookings_shop_start_idx').on(table.shopId, table.startAt),
    index('bookings_customer_id_idx').on(table.customerId),
    index('bookings_barber_start_idx').on(table.barberId, table.startAt),
    uniqueIndex('bookings_id_shop_unique').on(table.id, table.shopId),
    foreignKey({
      columns: [table.shopId, table.customerId],
      foreignColumns: [customers.shopId, customers.id],
      name: 'bookings_shop_customer_fk',
    }),
    foreignKey({
      columns: [table.shopId, table.serviceId],
      foreignColumns: [services.shopId, services.id],
      name: 'bookings_shop_service_fk',
    }),
    foreignKey({
      columns: [table.shopId, table.barberId],
      foreignColumns: [barberProfiles.shopId, barberProfiles.id],
      name: 'bookings_shop_barber_fk',
    }),
    check('bookings_time_range', sql`${table.startAt} < ${table.endAt}`),
    pgPolicy('bookings_tenant_context', {
      using: sql`current_setting('cukurpro.shop_id', true) = '' or ${table.shopId}::text = current_setting('cukurpro.shop_id', true)`,
    }),
  ],
).enableRLS();

export const bookingEvents = pgTable(
  'booking_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id').references(() => shops.id, {
      onDelete: 'restrict',
    }),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    actorStaffUserId: uuid('actor_staff_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    fromStatus: bookingStatus('from_status'),
    toStatus: bookingStatus('to_status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('booking_events_booking_id_idx').on(table.bookingId),
    index('booking_events_shop_id_idx').on(table.shopId),
    foreignKey({
      columns: [table.shopId, table.bookingId],
      foreignColumns: [bookings.shopId, bookings.id],
      name: 'booking_events_shop_booking_fk',
    }),
  ],
);

export const checkoutStatus = pgEnum('checkout_status', [
  'unpaid',
  'partially_paid',
  'paid',
  'refunded',
]);

export const checkouts = pgTable(
  'checkouts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    barberId: uuid('barber_id')
      .notNull()
      .references(() => barberProfiles.id, { onDelete: 'restrict' }),
    createdByStaffUserId: uuid('created_by_staff_user_id').references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    receiptNumber: text('receipt_number').notNull().unique(),
    subtotalRupiah: integer('subtotal_rupiah').notNull(),
    discountRupiah: integer('discount_rupiah').notNull().default(0),
    totalRupiah: integer('total_rupiah').notNull(),
    adjustmentReason: text('adjustment_reason').notNull().default(''),
    status: checkoutStatus('status').notNull().default('unpaid'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('checkouts_booking_id_unique').on(table.bookingId),
    index('checkouts_shop_created_idx').on(table.shopId, table.createdAt),
    index('checkouts_customer_id_idx').on(table.customerId),
    index('checkouts_barber_id_idx').on(table.barberId),
    uniqueIndex('checkouts_id_shop_unique').on(table.id, table.shopId),
    foreignKey({
      columns: [table.shopId, table.bookingId],
      foreignColumns: [bookings.shopId, bookings.id],
      name: 'checkouts_shop_booking_fk',
    }),
    foreignKey({
      columns: [table.shopId, table.customerId],
      foreignColumns: [customers.shopId, customers.id],
      name: 'checkouts_shop_customer_fk',
    }),
    foreignKey({
      columns: [table.shopId, table.barberId],
      foreignColumns: [barberProfiles.shopId, barberProfiles.id],
      name: 'checkouts_shop_barber_fk',
    }),
    check('checkouts_subtotal_nonnegative', sql`${table.subtotalRupiah} >= 0`),
    check('checkouts_discount_nonnegative', sql`${table.discountRupiah} >= 0`),
    check('checkouts_total_nonnegative', sql`${table.totalRupiah} >= 0`),
    check(
      'checkouts_totals_consistent',
      sql`${table.totalRupiah} = ${table.subtotalRupiah} - ${table.discountRupiah} and ${table.discountRupiah} <= ${table.subtotalRupiah}`,
    ),
    pgPolicy('checkouts_tenant_context', {
      using: sql`current_setting('cukurpro.shop_id', true) = '' or ${table.shopId}::text = current_setting('cukurpro.shop_id', true)`,
    }),
  ],
).enableRLS();

export const checkoutItems = pgTable(
  'checkout_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id').references(() => shops.id, {
      onDelete: 'restrict',
    }),
    checkoutId: uuid('checkout_id')
      .notNull()
      .references(() => checkouts.id, { onDelete: 'restrict' }),
    serviceId: uuid('service_id').references(() => services.id, {
      onDelete: 'set null',
    }),
    description: text('description').notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitPriceRupiah: integer('unit_price_rupiah').notNull(),
    lineTotalRupiah: integer('line_total_rupiah').notNull(),
  },
  (table) => [
    index('checkout_items_checkout_id_idx').on(table.checkoutId),
    index('checkout_items_shop_id_idx').on(table.shopId),
    foreignKey({
      columns: [table.shopId, table.checkoutId],
      foreignColumns: [checkouts.shopId, checkouts.id],
      name: 'checkout_items_shop_checkout_fk',
    }),
    check('checkout_items_quantity_positive', sql`${table.quantity} > 0`),
    check(
      'checkout_items_unit_price_nonnegative',
      sql`${table.unitPriceRupiah} >= 0`,
    ),
    check(
      'checkout_items_line_total_nonnegative',
      sql`${table.lineTotalRupiah} >= 0`,
    ),
    check(
      'checkout_items_total_consistent',
      sql`${table.lineTotalRupiah} = ${table.quantity} * ${table.unitPriceRupiah}`,
    ),
  ],
);

export const paymentMethod = pgEnum('payment_method', [
  'cash',
  'card',
  'bank_transfer',
  'qris',
]);

export const checkoutPayments = pgTable(
  'checkout_payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id').references(() => shops.id, {
      onDelete: 'restrict',
    }),
    checkoutId: uuid('checkout_id')
      .notNull()
      .references(() => checkouts.id, { onDelete: 'restrict' }),
    amountRupiah: integer('amount_rupiah').notNull(),
    method: paymentMethod('method').notNull(),
    reference: text('reference').notNull().default(''),
    idempotencyKey: uuid('idempotency_key').notNull(),
    recordedByStaffUserId: uuid('recorded_by_staff_user_id').references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('checkout_payments_checkout_id_idx').on(table.checkoutId),
    index('checkout_payments_shop_id_idx').on(table.shopId),
    uniqueIndex('checkout_payments_id_shop_unique').on(table.id, table.shopId),
    foreignKey({
      columns: [table.shopId, table.checkoutId],
      foreignColumns: [checkouts.shopId, checkouts.id],
      name: 'checkout_payments_shop_checkout_fk',
    }),
    uniqueIndex('checkout_payments_checkout_idempotency_unique').on(
      table.checkoutId,
      table.idempotencyKey,
    ),
    check('checkout_payments_amount_positive', sql`${table.amountRupiah} > 0`),
  ],
);

export const paymentCorrectionKind = pgEnum('payment_correction_kind', [
  'refund',
  'void',
]);

export const paymentCorrections = pgTable(
  'payment_corrections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id').references(() => shops.id, {
      onDelete: 'restrict',
    }),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => checkoutPayments.id, { onDelete: 'restrict' }),
    kind: paymentCorrectionKind('kind').notNull(),
    amountRupiah: integer('amount_rupiah').notNull(),
    reason: text('reason').notNull(),
    idempotencyKey: uuid('idempotency_key').notNull(),
    recordedByStaffUserId: uuid('recorded_by_staff_user_id').references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('payment_corrections_payment_id_idx').on(table.paymentId),
    index('payment_corrections_shop_id_idx').on(table.shopId),
    foreignKey({
      columns: [table.shopId, table.paymentId],
      foreignColumns: [checkoutPayments.shopId, checkoutPayments.id],
      name: 'payment_corrections_shop_payment_fk',
    }),
    uniqueIndex('payment_corrections_payment_idempotency_unique').on(
      table.paymentId,
      table.idempotencyKey,
    ),
    check(
      'payment_corrections_amount_positive',
      sql`${table.amountRupiah} > 0`,
    ),
  ],
);
