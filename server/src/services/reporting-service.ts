import { and, asc, eq, gte, inArray, lt } from 'drizzle-orm';

import type { Database } from '../db/client';
import {
  barberProfiles,
  bookings,
  checkoutPayments,
  checkouts,
  customers,
  paymentCorrections,
  services,
  shops,
} from '../db/schema';
import { localDateForInstant, zonedMinuteToDate } from './availability-service';
import type { AuthUser } from './auth-service';
import type { DashboardQuery, ReportRangeQuery } from '../schemas/reporting';

export type OperationalAppointment = {
  id: string;
  startAt: Date;
  endAt: Date;
  status: string;
  confirmationCode: string;
  customer: { id: string; name: string; phone: string };
  barber: { id: string; name: string };
  service: { id: string; name: string };
};

export type OperationalDashboard = {
  date: string;
  timezone: string;
  totals: {
    appointments: number;
    upcoming: number;
    queue: number;
    completed: number;
    cancelled: number;
    noShow: number;
    initial: number;
    confirmed: number;
    rescheduled: number;
    checkedIn: number;
    inService: number;
  };
  appointments: OperationalAppointment[];
};

export type RevenueReport = {
  from: string;
  to: string;
  timezone: string;
  grossRupiah: number;
  correctionsRupiah: number;
  netRupiah: number;
  paymentCount: number;
  transactionCount: number;
};

export type PerformanceRow = {
  id: string;
  name: string;
  bookingCount: number;
  completionCount: number;
  attributedRevenueRupiah: number;
};

export type PerformanceReport = {
  from: string;
  to: string;
  timezone: string;
  staff: PerformanceRow[];
  services: PerformanceRow[];
};

export type ReportingErrorCode = 'REPORT_INVALID_RANGE' | 'NOT_FOUND';

export class ReportingDomainError extends Error {
  public constructor(
    public readonly code: ReportingErrorCode,
    message: string,
    public readonly status: 400 | 404,
  ) {
    super(message);
  }
}

export function summarizeRevenue(
  paymentAmounts: number[],
  correctionAmounts: number[],
) {
  const grossRupiah = paymentAmounts.reduce((sum, amount) => sum + amount, 0);
  const correctionsRupiah = correctionAmounts.reduce(
    (sum, amount) => sum + amount,
    0,
  );
  return {
    grossRupiah,
    correctionsRupiah,
    netRupiah: grossRupiah - correctionsRupiah,
  };
}

export interface ReportingService {
  dashboard(
    actor: AuthUser,
    query: DashboardQuery,
  ): Promise<OperationalDashboard>;
  revenue(actor: AuthUser, query: ReportRangeQuery): Promise<RevenueReport>;
  performance(
    actor: AuthUser,
    query: ReportRangeQuery,
  ): Promise<PerformanceReport>;
}

export type ReportDateRange = {
  from: string;
  to: string;
  timezone: string;
  start: Date;
  end: Date;
};

export function reportDateRange(
  timezone: string,
  from: string | undefined,
  to: string | undefined,
  now: Date,
): ReportDateRange {
  const current = localDateForInstant(now, timezone);
  const startDate = from ?? to ?? current;
  const endDate = to ?? from ?? current;
  const start = zonedMinuteToDate(startDate, 0, timezone);
  const endDay = zonedMinuteToDate(endDate, 1440, timezone);
  if (!start || !endDay || startDate > endDate)
    throw new ReportingDomainError(
      'REPORT_INVALID_RANGE',
      'The report date range is invalid for the shop timezone.',
      400,
    );
  return { from: startDate, to: endDate, timezone, start, end: endDay };
}

export function createReportingService(
  database: Database,
  now: () => Date = () => new Date(),
): ReportingService {
  async function shopTimezone(shopId: string): Promise<string> {
    const shop = await database
      .select({ timezone: shops.timezone })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1)
      .then((rows) => rows[0]);
    if (!shop)
      throw new ReportingDomainError('NOT_FOUND', 'Shop not found.', 404);
    return shop.timezone;
  }

  async function appointments(actor: AuthUser, range: ReportDateRange) {
    return database
      .select({
        booking: bookings,
        customer: {
          id: customers.id,
          name: customers.name,
          phone: customers.phone,
        },
        barber: { id: barberProfiles.id, name: barberProfiles.name },
        service: { id: services.id, name: services.name },
      })
      .from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .innerJoin(barberProfiles, eq(bookings.barberId, barberProfiles.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(
        and(
          eq(bookings.shopId, actor.shopId),
          gte(bookings.startAt, range.start),
          lt(bookings.startAt, range.end),
        ),
      )
      .orderBy(asc(bookings.startAt));
  }

  return {
    async dashboard(actor, query) {
      const timezone = await shopTimezone(actor.shopId);
      const range = reportDateRange(timezone, query.date, query.date, now());
      const rows = await appointments(actor, range);
      const current = now();
      const totals = {
        appointments: rows.length,
        upcoming: rows.filter(
          ({ booking }) =>
            [
              'initial',
              'confirmed',
              'rescheduled',
              'checked_in',
              'in_service',
            ].includes(booking.status) && booking.startAt >= current,
        ).length,
        queue: rows.filter(({ booking }) =>
          ['checked_in', 'in_service'].includes(booking.status),
        ).length,
        completed: rows.filter(({ booking }) => booking.status === 'completed')
          .length,
        cancelled: rows.filter(({ booking }) => booking.status === 'cancelled')
          .length,
        noShow: rows.filter(({ booking }) => booking.status === 'no_show')
          .length,
        initial: rows.filter(({ booking }) => booking.status === 'initial')
          .length,
        confirmed: rows.filter(({ booking }) => booking.status === 'confirmed')
          .length,
        rescheduled: rows.filter(
          ({ booking }) => booking.status === 'rescheduled',
        ).length,
        checkedIn: rows.filter(({ booking }) => booking.status === 'checked_in')
          .length,
        inService: rows.filter(({ booking }) => booking.status === 'in_service')
          .length,
      };
      return {
        date: range.from,
        timezone,
        totals,
        appointments: rows.map(({ booking, customer, barber, service }) => ({
          id: booking.id,
          startAt: booking.startAt,
          endAt: booking.endAt,
          status: booking.status,
          confirmationCode: booking.confirmationCode,
          customer,
          barber,
          service,
        })),
      };
    },

    async revenue(actor, query) {
      const timezone = await shopTimezone(actor.shopId);
      const range = reportDateRange(timezone, query.from, query.to, now());
      const payments = await database
        .select({ payment: checkoutPayments, checkoutId: checkouts.id })
        .from(checkoutPayments)
        .innerJoin(checkouts, eq(checkoutPayments.checkoutId, checkouts.id))
        .where(
          and(
            eq(checkouts.shopId, actor.shopId),
            gte(checkoutPayments.createdAt, range.start),
            lt(checkoutPayments.createdAt, range.end),
          ),
        );
      const paymentIds = payments.map(({ payment }) => payment.id);
      const corrections = paymentIds.length
        ? await database
            .select()
            .from(paymentCorrections)
            .where(inArray(paymentCorrections.paymentId, paymentIds))
        : [];
      const totals = summarizeRevenue(
        payments.map(({ payment }) => payment.amountRupiah),
        corrections.map((correction) => correction.amountRupiah),
      );
      return {
        from: range.from,
        to: range.to,
        timezone,
        ...totals,
        paymentCount: payments.length,
        transactionCount: new Set(payments.map(({ checkoutId }) => checkoutId))
          .size,
      };
    },

    async performance(actor, query) {
      const timezone = await shopTimezone(actor.shopId);
      const range = reportDateRange(timezone, query.from, query.to, now());
      const rows = await appointments(actor, range);
      const bookingIds = rows.map(({ booking }) => booking.id);
      const checkoutRows = bookingIds.length
        ? await database
            .select({ checkout: checkouts, payment: checkoutPayments })
            .from(checkouts)
            .innerJoin(
              checkoutPayments,
              eq(checkouts.id, checkoutPayments.checkoutId),
            )
            .where(
              and(
                eq(checkouts.shopId, actor.shopId),
                inArray(checkouts.bookingId, bookingIds),
              ),
            )
        : [];
      const correctionRows = checkoutRows.length
        ? await database
            .select({
              correction: paymentCorrections,
              paymentId: checkoutPayments.id,
            })
            .from(paymentCorrections)
            .innerJoin(
              checkoutPayments,
              eq(paymentCorrections.paymentId, checkoutPayments.id),
            )
            .where(
              inArray(
                checkoutPayments.checkoutId,
                checkoutRows.map(({ checkout }) => checkout.id),
              ),
            )
        : [];
      const correctionsByPayment = new Map<string, number>();
      for (const { correction, paymentId } of correctionRows)
        correctionsByPayment.set(
          paymentId,
          (correctionsByPayment.get(paymentId) ?? 0) + correction.amountRupiah,
        );
      const revenueByBooking = new Map<string, number>();
      for (const { checkout, payment } of checkoutRows)
        revenueByBooking.set(
          checkout.bookingId,
          (revenueByBooking.get(checkout.bookingId) ?? 0) +
            payment.amountRupiah -
            (correctionsByPayment.get(payment.id) ?? 0),
        );
      const aggregate = (key: 'barber' | 'service'): PerformanceRow[] => {
        const map = new Map<string, PerformanceRow>();
        for (const row of rows) {
          const entity = row[key];
          const current = map.get(entity.id) ?? {
            id: entity.id,
            name: entity.name,
            bookingCount: 0,
            completionCount: 0,
            attributedRevenueRupiah: 0,
          };
          current.bookingCount += 1;
          if (row.booking.status === 'completed') current.completionCount += 1;
          current.attributedRevenueRupiah +=
            revenueByBooking.get(row.booking.id) ?? 0;
          map.set(entity.id, current);
        }
        return [...map.values()].sort(
          (left, right) =>
            right.attributedRevenueRupiah - left.attributedRevenueRupiah ||
            left.name.localeCompare(right.name),
        );
      };
      return {
        from: range.from,
        to: range.to,
        timezone,
        staff: aggregate('barber'),
        services: aggregate('service'),
      };
    },
  };
}
