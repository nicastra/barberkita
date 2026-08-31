import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  integer,
  index,
  jsonb,
  pgEnum,
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

export const staffRole = pgEnum('staff_role', ['owner', 'staff']);

export const shops = pgTable('shops', {
  id: uuid('id').defaultRandom().primaryKey(),
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
});

export const staffUsers = pgTable(
  'staff_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: staffRole('role').notNull().default('staff'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('staff_users_shop_id_idx').on(table.shopId)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    staffUserId: uuid('staff_user_id')
      .notNull()
      .references(() => staffUsers.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('sessions_staff_user_id_idx').on(table.staffUserId)],
);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorStaffUserId: uuid('actor_staff_user_id').references(
    () => staffUsers.id,
    { onDelete: 'set null' },
  ),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

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
    check('services_duration_positive', sql`${table.durationMinutes} > 0`),
    check('services_price_nonnegative', sql`${table.priceRupiah} >= 0`),
  ],
);

export const barberProfiles = pgTable(
  'barber_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    staffUserId: uuid('staff_user_id').references(() => staffUsers.id, {
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
    uniqueIndex('barber_profiles_staff_user_id_unique').on(table.staffUserId),
  ],
);

export const barberServices = pgTable(
  'barber_services',
  {
    barberId: uuid('barber_id')
      .notNull()
      .references(() => barberProfiles.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.barberId, table.serviceId] }),
    index('barber_services_service_id_idx').on(table.serviceId),
  ],
);

export const barberWorkingHours = pgTable(
  'barber_working_hours',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    barberId: uuid('barber_id')
      .notNull()
      .references(() => barberProfiles.id, { onDelete: 'cascade' }),
    dayOfWeek: smallint('day_of_week').notNull(),
    startMinute: smallint('start_minute').notNull(),
    endMinute: smallint('end_minute').notNull(),
  },
  (table) => [
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
    barberId: uuid('barber_id')
      .notNull()
      .references(() => barberProfiles.id, { onDelete: 'cascade' }),
    dayOfWeek: smallint('day_of_week').notNull(),
    startMinute: smallint('start_minute').notNull(),
    endMinute: smallint('end_minute').notNull(),
  },
  (table) => [
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
  ],
);

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
      () => staffUsers.id,
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
    check('bookings_time_range', sql`${table.startAt} < ${table.endAt}`),
  ],
);

export const bookingEvents = pgTable(
  'booking_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    actorStaffUserId: uuid('actor_staff_user_id').references(
      () => staffUsers.id,
      { onDelete: 'set null' },
    ),
    fromStatus: bookingStatus('from_status'),
    toStatus: bookingStatus('to_status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('booking_events_booking_id_idx').on(table.bookingId)],
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
      () => staffUsers.id,
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
    check('checkouts_subtotal_nonnegative', sql`${table.subtotalRupiah} >= 0`),
    check('checkouts_discount_nonnegative', sql`${table.discountRupiah} >= 0`),
    check('checkouts_total_nonnegative', sql`${table.totalRupiah} >= 0`),
    check(
      'checkouts_totals_consistent',
      sql`${table.totalRupiah} = ${table.subtotalRupiah} - ${table.discountRupiah} and ${table.discountRupiah} <= ${table.subtotalRupiah}`,
    ),
  ],
);

export const checkoutItems = pgTable(
  'checkout_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
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
    checkoutId: uuid('checkout_id')
      .notNull()
      .references(() => checkouts.id, { onDelete: 'restrict' }),
    amountRupiah: integer('amount_rupiah').notNull(),
    method: paymentMethod('method').notNull(),
    reference: text('reference').notNull().default(''),
    idempotencyKey: uuid('idempotency_key').notNull(),
    recordedByStaffUserId: uuid('recorded_by_staff_user_id').references(
      () => staffUsers.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('checkout_payments_checkout_id_idx').on(table.checkoutId),
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
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => checkoutPayments.id, { onDelete: 'restrict' }),
    kind: paymentCorrectionKind('kind').notNull(),
    amountRupiah: integer('amount_rupiah').notNull(),
    reason: text('reason').notNull(),
    idempotencyKey: uuid('idempotency_key').notNull(),
    recordedByStaffUserId: uuid('recorded_by_staff_user_id').references(
      () => staffUsers.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('payment_corrections_payment_id_idx').on(table.paymentId),
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
