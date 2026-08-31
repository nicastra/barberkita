import { randomBytes } from 'node:crypto';

import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';

import type { Database } from '../db/client';
import {
  auditLogs,
  barberProfiles,
  bookings,
  checkoutItems,
  checkoutPayments,
  checkouts,
  customers,
  paymentCorrections,
  services,
  shops,
} from '../db/schema';
import type { AuthUser } from './auth-service';
import type {
  CreateCheckoutInput,
  PaymentCorrectionInput,
  RecordPaymentInput,
} from '../schemas/checkouts';

export type CheckoutStatus = 'unpaid' | 'partially_paid' | 'paid' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'qris';
export type PaymentCorrectionKind = 'refund' | 'void';

export type CheckoutPaymentView = {
  id: string;
  amountRupiah: number;
  method: PaymentMethod;
  reference: string;
  idempotencyKey: string;
  recordedByStaffUserId: string | null;
  createdAt: Date;
  correctedRupiah: number;
  netAmountRupiah: number;
  corrections: {
    id: string;
    kind: PaymentCorrectionKind;
    amountRupiah: number;
    reason: string;
    recordedByStaffUserId: string | null;
    createdAt: Date;
  }[];
};

export type CheckoutView = {
  id: string;
  shopId: string;
  bookingId: string;
  customerId: string;
  barberId: string;
  createdByStaffUserId: string | null;
  receiptNumber: string;
  subtotalRupiah: number;
  discountRupiah: number;
  totalRupiah: number;
  adjustmentReason: string;
  status: CheckoutStatus;
  paidRupiah: number;
  remainingRupiah: number;
  createdAt: Date;
  updatedAt: Date;
  customer: { id: string; name: string; phone: string; email: string | null };
  barber: { id: string; name: string };
  appointment: { startAt: Date; endAt: Date; confirmationCode: string };
  items: {
    id: string;
    serviceId: string | null;
    description: string;
    quantity: number;
    unitPriceRupiah: number;
    lineTotalRupiah: number;
  }[];
  payments: CheckoutPaymentView[];
  shop: { id: string; name: string; timezone: string };
};

export type CheckoutErrorCode =
  | 'CHECKOUT_NOT_COMPLETED'
  | 'CHECKOUT_ALREADY_EXISTS'
  | 'CHECKOUT_INVALID_ADJUSTMENT'
  | 'CHECKOUT_PAYMENT_EXCEEDS_REMAINING'
  | 'CHECKOUT_PAYMENT_IDEMPOTENCY_CONFLICT'
  | 'CHECKOUT_PAYMENT_NOT_FOUND'
  | 'CHECKOUT_PAYMENT_ALREADY_CORRECTED'
  | 'CHECKOUT_CORRECTION_EXCEEDS_REMAINING'
  | 'CHECKOUT_CORRECTION_INVALID'
  | 'NOT_FOUND';

export class CheckoutDomainError extends Error {
  public constructor(
    public readonly code: CheckoutErrorCode,
    message: string,
    public readonly status: 400 | 404 | 409,
  ) {
    super(message);
  }
}

export interface CheckoutService {
  list(
    actor: AuthUser,
    filters: {
      query?: string | undefined;
      status?: CheckoutStatus | undefined;
    },
  ): Promise<CheckoutView[]>;
  create(actor: AuthUser, input: CreateCheckoutInput): Promise<CheckoutView>;
  get(actor: AuthUser, id: string): Promise<CheckoutView | null>;
  recordPayment(
    actor: AuthUser,
    id: string,
    input: RecordPaymentInput,
  ): Promise<CheckoutView>;
  correctPayment(
    actor: AuthUser,
    id: string,
    paymentId: string,
    input: PaymentCorrectionInput,
  ): Promise<CheckoutView>;
}

function receiptNumber(): string {
  return `RCPT-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(5).toString('hex').toUpperCase()}`;
}

function statusFor(
  total: number,
  paid: number,
  hasCorrection: boolean,
): CheckoutStatus {
  if (paid >= total) return 'paid';
  if (paid > 0) return 'partially_paid';
  return hasCorrection ? 'refunded' : 'unpaid';
}

export function calculateCheckoutTotals(
  subtotalRupiah: number,
  discountRupiah: number,
): { subtotalRupiah: number; discountRupiah: number; totalRupiah: number } {
  if (!Number.isSafeInteger(subtotalRupiah) || subtotalRupiah < 0)
    throw new CheckoutDomainError(
      'CHECKOUT_INVALID_ADJUSTMENT',
      'The subtotal must be a non-negative integer.',
      400,
    );
  if (
    !Number.isSafeInteger(discountRupiah) ||
    discountRupiah < 0 ||
    discountRupiah > subtotalRupiah
  )
    throw new CheckoutDomainError(
      'CHECKOUT_INVALID_ADJUSTMENT',
      'The discount cannot exceed the subtotal.',
      400,
    );
  return {
    subtotalRupiah,
    discountRupiah,
    totalRupiah: subtotalRupiah - discountRupiah,
  };
}

export function createCheckoutService(database: Database): CheckoutService {
  async function getById(
    shopId: string,
    id: string,
  ): Promise<CheckoutView | null> {
    const row = await database
      .select({
        checkout: checkouts,
        customer: {
          id: customers.id,
          name: customers.name,
          phone: customers.phone,
          email: customers.email,
        },
        barber: { id: barberProfiles.id, name: barberProfiles.name },
        appointment: {
          startAt: bookings.startAt,
          endAt: bookings.endAt,
          confirmationCode: bookings.confirmationCode,
        },
        shop: { id: shops.id, name: shops.name, timezone: shops.timezone },
      })
      .from(checkouts)
      .innerJoin(customers, eq(checkouts.customerId, customers.id))
      .innerJoin(barberProfiles, eq(checkouts.barberId, barberProfiles.id))
      .innerJoin(bookings, eq(checkouts.bookingId, bookings.id))
      .innerJoin(shops, eq(checkouts.shopId, shops.id))
      .where(and(eq(checkouts.shopId, shopId), eq(checkouts.id, id)))
      .limit(1)
      .then((rows) => rows[0]);
    if (!row) return null;

    const [items, paymentRows, correctionRows] = await Promise.all([
      database
        .select()
        .from(checkoutItems)
        .where(eq(checkoutItems.checkoutId, id))
        .orderBy(asc(checkoutItems.id)),
      database
        .select()
        .from(checkoutPayments)
        .where(eq(checkoutPayments.checkoutId, id))
        .orderBy(asc(checkoutPayments.createdAt)),
      database
        .select()
        .from(paymentCorrections)
        .innerJoin(
          checkoutPayments,
          eq(paymentCorrections.paymentId, checkoutPayments.id),
        )
        .where(eq(checkoutPayments.checkoutId, id))
        .orderBy(asc(paymentCorrections.createdAt)),
    ]);
    const correctionsByPayment = new Map<string, typeof correctionRows>();
    for (const correction of correctionRows) {
      const list =
        correctionsByPayment.get(correction.payment_corrections.paymentId) ??
        [];
      list.push(correction);
      correctionsByPayment.set(correction.payment_corrections.paymentId, list);
    }
    const payments: CheckoutPaymentView[] = paymentRows.map((payment) => {
      const corrections = (correctionsByPayment.get(payment.id) ?? []).map(
        ({ payment_corrections: correction }) => correction,
      );
      const correctedRupiah = corrections.reduce(
        (sum, correction) => sum + correction.amountRupiah,
        0,
      );
      return {
        ...payment,
        correctedRupiah,
        netAmountRupiah: payment.amountRupiah - correctedRupiah,
        corrections,
      };
    });
    const paidRupiah = payments.reduce(
      (sum, payment) => sum + payment.netAmountRupiah,
      0,
    );
    const hasCorrection = payments.some(
      (payment) => payment.corrections.length > 0,
    );
    return {
      ...row.checkout,
      customer: row.customer,
      barber: row.barber,
      appointment: row.appointment,
      shop: row.shop,
      items,
      payments,
      paidRupiah,
      remainingRupiah: Math.max(0, row.checkout.totalRupiah - paidRupiah),
      status: statusFor(row.checkout.totalRupiah, paidRupiah, hasCorrection),
    };
  }

  async function updateStatus(
    transaction: Parameters<Parameters<Database['transaction']>[0]>[0],
    checkout: typeof checkouts.$inferSelect,
    paidRupiah: number,
    hasCorrection: boolean,
  ) {
    await transaction
      .update(checkouts)
      .set({
        status: statusFor(checkout.totalRupiah, paidRupiah, hasCorrection),
        updatedAt: new Date(),
      })
      .where(eq(checkouts.id, checkout.id));
  }

  return {
    async list(actor, filters) {
      const conditions = [eq(checkouts.shopId, actor.shopId)];
      if (filters.query) {
        const query = `%${filters.query}%`;
        conditions.push(
          or(
            ilike(checkouts.receiptNumber, query),
            ilike(customers.name, query),
            ilike(customers.phone, query),
          )!,
        );
      }
      const rows = await database
        .select({ id: checkouts.id })
        .from(checkouts)
        .innerJoin(customers, eq(checkouts.customerId, customers.id))
        .where(and(...conditions))
        .orderBy(desc(checkouts.createdAt))
        .limit(100);
      const values = await Promise.all(
        rows.map((row) => getById(actor.shopId, row.id)),
      );
      return values.filter((value): value is CheckoutView =>
        Boolean(value && (!filters.status || value.status === filters.status)),
      );
    },

    async create(actor, input) {
      const existing = await database
        .select({ id: checkouts.id })
        .from(checkouts)
        .where(
          and(
            eq(checkouts.shopId, actor.shopId),
            eq(checkouts.bookingId, input.bookingId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);
      if (existing) {
        const checkout = await getById(actor.shopId, existing.id);
        if (!checkout)
          throw new CheckoutDomainError(
            'NOT_FOUND',
            'Checkout not found.',
            404,
          );
        if (
          input.discountRupiah !== checkout.discountRupiah ||
          input.adjustmentReason !== checkout.adjustmentReason
        )
          throw new CheckoutDomainError(
            'CHECKOUT_ALREADY_EXISTS',
            'A checkout already exists for this appointment.',
            409,
          );
        return checkout;
      }
      const booking = await database
        .select({
          booking: bookings,
          service: {
            id: services.id,
            name: services.name,
            priceRupiah: services.priceRupiah,
          },
        })
        .from(bookings)
        .innerJoin(services, eq(bookings.serviceId, services.id))
        .where(
          and(
            eq(bookings.id, input.bookingId),
            eq(bookings.shopId, actor.shopId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);
      if (!booking)
        throw new CheckoutDomainError(
          'NOT_FOUND',
          'Appointment not found.',
          404,
        );
      if (booking.booking.status !== 'completed')
        throw new CheckoutDomainError(
          'CHECKOUT_NOT_COMPLETED',
          'Only completed services can be checked out.',
          400,
        );
      const totals = calculateCheckoutTotals(
        booking.service.priceRupiah,
        input.discountRupiah,
      );
      const created = await database.transaction(async (transaction) => {
        const [checkout] = await transaction
          .insert(checkouts)
          .values({
            shopId: actor.shopId,
            bookingId: input.bookingId,
            customerId: booking.booking.customerId,
            barberId: booking.booking.barberId,
            createdByStaffUserId: actor.id,
            receiptNumber: receiptNumber(),
            ...totals,
            adjustmentReason: input.adjustmentReason,
            status: totals.totalRupiah === 0 ? 'paid' : 'unpaid',
          })
          .returning();
        if (!checkout) throw new Error('Checkout creation failed.');
        await transaction.insert(checkoutItems).values({
          checkoutId: checkout.id,
          serviceId: booking.service.id,
          description: booking.service.name,
          quantity: 1,
          unitPriceRupiah: booking.service.priceRupiah,
          lineTotalRupiah: booking.service.priceRupiah,
        });
        await transaction.insert(auditLogs).values({
          actorStaffUserId: actor.id,
          action: 'checkout_created',
          entityType: 'checkout',
          entityId: checkout.id,
          metadata: {
            bookingId: input.bookingId,
            totalRupiah: totals.totalRupiah,
          },
        });
        return checkout.id;
      });
      const checkout = await getById(actor.shopId, created);
      if (!checkout) throw new Error('Checkout could not be loaded.');
      return checkout;
    },

    async get(actor, id) {
      return getById(actor.shopId, id);
    },

    async recordPayment(actor, id, input) {
      const checkoutId = await database.transaction(async (transaction) => {
        const checkout = await transaction
          .select()
          .from(checkouts)
          .where(and(eq(checkouts.id, id), eq(checkouts.shopId, actor.shopId)))
          .for('update')
          .limit(1)
          .then((rows) => rows[0]);
        if (!checkout)
          throw new CheckoutDomainError(
            'NOT_FOUND',
            'Checkout not found.',
            404,
          );
        const duplicate = await transaction
          .select()
          .from(checkoutPayments)
          .where(
            and(
              eq(checkoutPayments.checkoutId, id),
              eq(checkoutPayments.idempotencyKey, input.idempotencyKey),
            ),
          )
          .limit(1)
          .then((rows) => rows[0]);
        if (duplicate) {
          if (
            duplicate.amountRupiah !== input.amountRupiah ||
            duplicate.method !== input.method ||
            duplicate.reference !== input.reference
          )
            throw new CheckoutDomainError(
              'CHECKOUT_PAYMENT_IDEMPOTENCY_CONFLICT',
              'This idempotency key was already used for a different payment.',
              409,
            );
          return id;
        }
        const paymentRows = await transaction
          .select({ amountRupiah: checkoutPayments.amountRupiah })
          .from(checkoutPayments)
          .where(eq(checkoutPayments.checkoutId, id));
        const correctionRows = await transaction
          .select({ amountRupiah: paymentCorrections.amountRupiah })
          .from(paymentCorrections)
          .innerJoin(
            checkoutPayments,
            eq(paymentCorrections.paymentId, checkoutPayments.id),
          )
          .where(eq(checkoutPayments.checkoutId, id));
        const paid =
          paymentRows.reduce((sum, row) => sum + row.amountRupiah, 0) -
          correctionRows.reduce((sum, row) => sum + row.amountRupiah, 0);
        if (paid + input.amountRupiah > checkout.totalRupiah)
          throw new CheckoutDomainError(
            'CHECKOUT_PAYMENT_EXCEEDS_REMAINING',
            'The payment exceeds the remaining balance.',
            409,
          );
        await transaction.insert(checkoutPayments).values({
          checkoutId: id,
          amountRupiah: input.amountRupiah,
          method: input.method,
          reference: input.reference,
          idempotencyKey: input.idempotencyKey,
          recordedByStaffUserId: actor.id,
        });
        await updateStatus(
          transaction,
          checkout,
          paid + input.amountRupiah,
          correctionRows.length > 0,
        );
        await transaction.insert(auditLogs).values({
          actorStaffUserId: actor.id,
          action: 'payment_recorded',
          entityType: 'checkout',
          entityId: id,
          metadata: { amountRupiah: input.amountRupiah, method: input.method },
        });
        return id;
      });
      const checkout = await getById(actor.shopId, checkoutId);
      if (!checkout)
        throw new CheckoutDomainError('NOT_FOUND', 'Checkout not found.', 404);
      return checkout;
    },

    async correctPayment(actor, id, paymentId, input) {
      const checkoutId = await database.transaction(async (transaction) => {
        const checkout = await transaction
          .select()
          .from(checkouts)
          .where(and(eq(checkouts.id, id), eq(checkouts.shopId, actor.shopId)))
          .for('update')
          .limit(1)
          .then((rows) => rows[0]);
        if (!checkout)
          throw new CheckoutDomainError(
            'NOT_FOUND',
            'Checkout not found.',
            404,
          );
        const payment = await transaction
          .select()
          .from(checkoutPayments)
          .where(
            and(
              eq(checkoutPayments.id, paymentId),
              eq(checkoutPayments.checkoutId, id),
            ),
          )
          .limit(1)
          .then((rows) => rows[0]);
        if (!payment)
          throw new CheckoutDomainError(
            'CHECKOUT_PAYMENT_NOT_FOUND',
            'Payment not found.',
            404,
          );
        const duplicate = await transaction
          .select()
          .from(paymentCorrections)
          .where(
            and(
              eq(paymentCorrections.paymentId, paymentId),
              eq(paymentCorrections.idempotencyKey, input.idempotencyKey),
            ),
          )
          .limit(1)
          .then((rows) => rows[0]);
        if (duplicate) {
          const duplicateAmount =
            input.kind === 'void' ? payment.amountRupiah : input.amountRupiah!;
          if (
            duplicate.kind !== input.kind ||
            duplicate.amountRupiah !== duplicateAmount ||
            duplicate.reason !== input.reason
          )
            throw new CheckoutDomainError(
              'CHECKOUT_CORRECTION_INVALID',
              'This idempotency key was already used for a different correction.',
              409,
            );
          return id;
        }
        const previous = await transaction
          .select({ amountRupiah: paymentCorrections.amountRupiah })
          .from(paymentCorrections)
          .where(eq(paymentCorrections.paymentId, paymentId));
        const corrected = previous.reduce(
          (sum, row) => sum + row.amountRupiah,
          0,
        );
        const amount =
          input.kind === 'void' ? payment.amountRupiah : input.amountRupiah!;
        if (input.kind === 'void' && corrected > 0)
          throw new CheckoutDomainError(
            'CHECKOUT_PAYMENT_ALREADY_CORRECTED',
            'This payment has already been corrected.',
            409,
          );
        if (amount > payment.amountRupiah - corrected)
          throw new CheckoutDomainError(
            'CHECKOUT_CORRECTION_EXCEEDS_REMAINING',
            'The correction exceeds the remaining payment amount.',
            409,
          );
        await transaction.insert(paymentCorrections).values({
          paymentId,
          kind: input.kind,
          amountRupiah: amount,
          reason: input.reason,
          idempotencyKey: input.idempotencyKey,
          recordedByStaffUserId: actor.id,
        });
        const allPayments = await transaction
          .select({ amountRupiah: checkoutPayments.amountRupiah })
          .from(checkoutPayments)
          .where(eq(checkoutPayments.checkoutId, id));
        const allCorrections = await transaction
          .select({ amountRupiah: paymentCorrections.amountRupiah })
          .from(paymentCorrections)
          .innerJoin(
            checkoutPayments,
            eq(paymentCorrections.paymentId, checkoutPayments.id),
          )
          .where(eq(checkoutPayments.checkoutId, id));
        const paid =
          allPayments.reduce((sum, row) => sum + row.amountRupiah, 0) -
          allCorrections.reduce((sum, row) => sum + row.amountRupiah, 0);
        await updateStatus(transaction, checkout, paid, true);
        await transaction.insert(auditLogs).values({
          actorStaffUserId: actor.id,
          action: input.kind === 'void' ? 'payment_voided' : 'payment_refunded',
          entityType: 'checkout_payment',
          entityId: paymentId,
          metadata: {
            checkoutId: id,
            amountRupiah: amount,
            reason: input.reason,
          },
        });
        return id;
      });
      const checkout = await getById(actor.shopId, checkoutId);
      if (!checkout)
        throw new CheckoutDomainError('NOT_FOUND', 'Checkout not found.', 404);
      return checkout;
    },
  };
}
