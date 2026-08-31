import { randomBytes } from 'node:crypto';

import {
  and,
  asc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm';

import type { Database } from '../db/client';
import {
  auditLogs,
  barberProfiles,
  barberServices,
  bookingEvents,
  bookings,
  customers,
  services,
  shops,
  staffUsers,
} from '../db/schema';
import type { AuthUser } from './auth-service';
import {
  localDateForInstant,
  zonedMinuteToDate,
  type AvailabilityResult,
  type AvailabilityService,
  type ReservationSource,
} from './availability-service';
import type { CustomerInput, CustomerService } from './customer-service';

export type BookingStatus =
  | 'initial'
  | 'confirmed'
  | 'rescheduled'
  | 'checked_in'
  | 'in_service'
  | 'completed'
  | 'cancelled'
  | 'no_show';
type BookingSource = 'staff' | 'public' | 'walk_in';

export type BookingSelection = {
  serviceId: string;
  barberId: string;
  startAt: string;
};

export type BookingView = {
  id: string;
  shopId: string;
  customerId: string;
  serviceId: string;
  barberId: string;
  createdByStaffUserId: string | null;
  startAt: Date;
  endAt: Date;
  status: BookingStatus;
  source: BookingSource;
  confirmationCode: string;
  notes: string;
  checkedInAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  noShowAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  };
  service: {
    id: string;
    name: string;
    durationMinutes: number;
    priceRupiah: number;
  };
  barber: { id: string; name: string };
  shop: {
    id: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    timezone: string;
  };
};

export type PublicOptions = {
  shop: BookingView['shop'];
  services: {
    id: string;
    name: string;
    description: string;
    durationMinutes: number;
    priceRupiah: number;
  }[];
  barbers: { id: string; name: string; serviceIds: string[] }[];
};

export type BookingErrorCode =
  | 'BOOKING_IN_PAST'
  | 'BOOKING_OPTION_INVALID'
  | 'BOOKING_TIME_UNAVAILABLE'
  | 'BOOKING_TRANSITION_INVALID'
  | 'NOT_FOUND';

export class BookingDomainError extends Error {
  public constructor(
    public readonly code: BookingErrorCode,
    message: string,
    public readonly status: 400 | 404 | 409,
  ) {
    super(message);
  }
}

export interface BookingService {
  list(
    actor: AuthUser,
    filters: {
      customerId?: string | undefined;
      barberId?: string | undefined;
      status?: BookingStatus | undefined;
      date?: string | undefined;
    },
  ): Promise<BookingView[]>;
  createStaff(
    actor: AuthUser,
    input: BookingSelection & { customerId: string; notes: string },
  ): Promise<BookingView>;
  createWalkIn(
    actor: AuthUser,
    input: BookingSelection & { customerId: string; notes: string },
  ): Promise<BookingView>;
  createPublic(
    input: BookingSelection & { customer: Omit<CustomerInput, 'notes'> },
  ): Promise<BookingView>;
  confirm(actor: AuthUser, id: string): Promise<BookingView>;
  cancel(actor: AuthUser, id: string): Promise<BookingView>;
  checkIn(actor: AuthUser, id: string): Promise<BookingView>;
  startService(actor: AuthUser, id: string): Promise<BookingView>;
  complete(actor: AuthUser, id: string): Promise<BookingView>;
  markNoShow(actor: AuthUser, id: string): Promise<BookingView>;
  reschedule(
    actor: AuthUser,
    id: string,
    input: BookingSelection,
  ): Promise<BookingView>;
  getPublicOptions(): Promise<PublicOptions | null>;
  findPublicAvailability(input: {
    serviceId: string;
    barberId?: string | undefined;
    date: string;
  }): Promise<AvailabilityResult | null>;
}

function confirmationCode(): string {
  return randomBytes(9).toString('base64url').toUpperCase();
}

export function hasDatabaseCode(error: unknown, code: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth += 1) {
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

export function createBookingReservationSource(
  database: Database,
): ReservationSource {
  return {
    async listBetween(barberIds, startAt, endAt, excludeReservationId) {
      if (barberIds.length === 0) return [];
      const conditions = [
        inArray(bookings.barberId, barberIds),
        inArray(bookings.status, [
          'initial',
          'confirmed',
          'rescheduled',
          'checked_in',
          'in_service',
        ]),
        lt(bookings.startAt, endAt),
        gt(bookings.endAt, startAt),
      ];
      if (excludeReservationId)
        conditions.push(ne(bookings.id, excludeReservationId));
      return database
        .select({
          barberId: bookings.barberId,
          startAt: bookings.startAt,
          endAt: bookings.endAt,
        })
        .from(bookings)
        .where(and(...conditions));
    },
  };
}

export function createBookingService(
  database: Database,
  availabilityService: AvailabilityService,
  customerService: CustomerService,
  now: () => Date = () => new Date(),
): BookingService {
  async function getBooking(
    shopId: string,
    id: string,
  ): Promise<BookingView | null> {
    return database
      .select({
        booking: bookings,
        customer: {
          id: customers.id,
          name: customers.name,
          phone: customers.phone,
          email: customers.email,
        },
        service: {
          id: services.id,
          name: services.name,
          durationMinutes: services.durationMinutes,
          priceRupiah: services.priceRupiah,
        },
        barber: { id: barberProfiles.id, name: barberProfiles.name },
        shop: {
          id: shops.id,
          name: shops.name,
          phone: shops.phone,
          email: shops.email,
          address: shops.address,
          timezone: shops.timezone,
        },
      })
      .from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .innerJoin(barberProfiles, eq(bookings.barberId, barberProfiles.id))
      .innerJoin(shops, eq(bookings.shopId, shops.id))
      .where(and(eq(bookings.id, id), eq(bookings.shopId, shopId)))
      .limit(1)
      .then((rows) => {
        const row = rows[0];
        if (!row) return null;
        const { booking, ...details } = row;
        return { ...booking, ...details };
      });
  }

  async function requireAvailable(
    shopId: string,
    input: BookingSelection,
    excludeReservationId?: string,
  ) {
    const startAt = new Date(input.startAt);
    if (startAt <= now())
      throw new BookingDomainError(
        'BOOKING_IN_PAST',
        'Appointments must start in the future.',
        400,
      );
    const shop = await database
      .select({ timezone: shops.timezone })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1)
      .then((rows) => rows[0]);
    if (!shop)
      throw new BookingDomainError('NOT_FOUND', 'Shop not found.', 404);
    const availability = await availabilityService.findSlots({
      shopId,
      serviceId: input.serviceId,
      barberId: input.barberId,
      date: localDateForInstant(startAt, shop.timezone),
      intervalMinutes: 5,
      excludeReservationId,
    });
    if (!availability)
      throw new BookingDomainError(
        'BOOKING_OPTION_INVALID',
        'The selected service is inactive or invalid.',
        400,
      );
    const slot = availability.slots.find(
      (candidate) =>
        candidate.barberId === input.barberId &&
        new Date(candidate.startAt).getTime() === startAt.getTime(),
    );
    if (!slot)
      throw new BookingDomainError(
        'BOOKING_TIME_UNAVAILABLE',
        'The selected time is no longer available.',
        409,
      );
    return { startAt, endAt: new Date(slot.endAt) };
  }

  async function insertBooking(input: {
    shopId: string;
    customerId: string;
    selection: BookingSelection;
    startAt: Date;
    endAt: Date;
    source: BookingSource;
    actorStaffUserId: string | null;
    notes: string;
    status?: 'initial' | 'confirmed';
  }) {
    try {
      const id = await database.transaction(async (transaction) => {
        const [booking] = await transaction
          .insert(bookings)
          .values({
            shopId: input.shopId,
            customerId: input.customerId,
            serviceId: input.selection.serviceId,
            barberId: input.selection.barberId,
            createdByStaffUserId: input.actorStaffUserId,
            startAt: input.startAt,
            endAt: input.endAt,
            source: input.source,
            confirmationCode: confirmationCode(),
            notes: input.notes,
            status: input.status ?? 'initial',
          })
          .returning({ id: bookings.id });
        if (!booking) throw new Error('Booking creation failed.');
        await transaction.insert(bookingEvents).values({
          bookingId: booking.id,
          actorStaffUserId: input.actorStaffUserId,
          fromStatus: null,
          toStatus: input.status ?? 'initial',
        });
        await transaction.insert(auditLogs).values({
          actorStaffUserId: input.actorStaffUserId,
          action: 'booking_created',
          entityType: 'booking',
          entityId: booking.id,
          metadata: { source: input.source },
        });
        return booking.id;
      });
      const booking = await getBooking(input.shopId, id);
      if (!booking) throw new Error('Created booking was not found.');
      return booking;
    } catch (error) {
      if (hasDatabaseCode(error, '23P01'))
        throw new BookingDomainError(
          'BOOKING_TIME_UNAVAILABLE',
          'The selected time was just reserved by another booking.',
          409,
        );
      throw error;
    }
  }

  async function transition(
    actor: AuthUser,
    id: string,
    toStatus: 'confirmed' | 'cancelled',
  ) {
    const existing = await getBooking(actor.shopId, id);
    if (!existing)
      throw new BookingDomainError('NOT_FOUND', 'Booking not found.', 404);
    const valid =
      toStatus === 'confirmed'
        ? existing.status === 'initial' || existing.status === 'rescheduled'
        : ['initial', 'confirmed', 'rescheduled', 'checked_in'].includes(
            existing.status,
          );
    if (!valid)
      throw new BookingDomainError(
        'BOOKING_TRANSITION_INVALID',
        `A ${existing.status} booking cannot become ${toStatus}.`,
        409,
      );
    await database.transaction(async (transaction) => {
      const changed = await transaction
        .update(bookings)
        .set({
          status: toStatus,
          cancelledAt: toStatus === 'cancelled' ? now() : undefined,
          updatedAt: now(),
        })
        .where(and(eq(bookings.id, id), eq(bookings.status, existing.status)))
        .returning({ id: bookings.id });
      if (!changed.length)
        throw new BookingDomainError(
          'BOOKING_TRANSITION_INVALID',
          'The booking changed while this request was being processed.',
          409,
        );
      await transaction.insert(bookingEvents).values({
        bookingId: id,
        actorStaffUserId: actor.id,
        fromStatus: existing.status,
        toStatus,
      });
      await transaction.insert(auditLogs).values({
        actorStaffUserId: actor.id,
        action: `booking_${toStatus}`,
        entityType: 'booking',
        entityId: id,
      });
    });
    const booking = await getBooking(actor.shopId, id);
    if (!booking) throw new Error('Updated booking was not found.');
    return booking;
  }

  async function operationalTransition(
    actor: AuthUser,
    id: string,
    toStatus: 'checked_in' | 'in_service' | 'completed' | 'no_show',
  ) {
    const existing = await getBooking(actor.shopId, id);
    if (!existing)
      throw new BookingDomainError('NOT_FOUND', 'Booking not found.', 404);
    const validTransitions: Record<typeof toStatus, BookingStatus[]> = {
      checked_in: ['confirmed', 'rescheduled'],
      in_service: ['checked_in'],
      completed: ['in_service'],
      no_show: ['confirmed', 'rescheduled'],
    };
    if (!validTransitions[toStatus].includes(existing.status))
      throw new BookingDomainError(
        'BOOKING_TRANSITION_INVALID',
        `A ${existing.status} booking cannot become ${toStatus}.`,
        409,
      );
    if (toStatus === 'no_show' && existing.startAt > now())
      throw new BookingDomainError(
        'BOOKING_TRANSITION_INVALID',
        'An appointment can only be marked no-show after its start time.',
        409,
      );
    const timestamp = now();
    const fields = {
      status: toStatus,
      checkedInAt: toStatus === 'checked_in' ? timestamp : undefined,
      startedAt: toStatus === 'in_service' ? timestamp : undefined,
      completedAt: toStatus === 'completed' ? timestamp : undefined,
      noShowAt: toStatus === 'no_show' ? timestamp : undefined,
      updatedAt: timestamp,
    };
    await database.transaction(async (transaction) => {
      const changed = await transaction
        .update(bookings)
        .set(fields)
        .where(and(eq(bookings.id, id), eq(bookings.status, existing.status)))
        .returning({ id: bookings.id });
      if (!changed.length)
        throw new BookingDomainError(
          'BOOKING_TRANSITION_INVALID',
          'The booking changed while this request was being processed.',
          409,
        );
      await transaction.insert(bookingEvents).values({
        bookingId: id,
        actorStaffUserId: actor.id,
        fromStatus: existing.status,
        toStatus,
      });
      await transaction.insert(auditLogs).values({
        actorStaffUserId: actor.id,
        action: `booking_${toStatus}`,
        entityType: 'booking',
        entityId: id,
      });
    });
    const booking = await getBooking(actor.shopId, id);
    if (!booking) throw new Error('Updated booking was not found.');
    return booking;
  }

  return {
    async list(actor, filters) {
      const conditions = [eq(bookings.shopId, actor.shopId)];
      if (filters.customerId)
        conditions.push(eq(bookings.customerId, filters.customerId));
      if (filters.barberId)
        conditions.push(eq(bookings.barberId, filters.barberId));
      if (filters.status) conditions.push(eq(bookings.status, filters.status));
      if (filters.date) {
        const timezone = await database
          .select({ timezone: shops.timezone })
          .from(shops)
          .where(eq(shops.id, actor.shopId))
          .limit(1)
          .then((rows) => rows[0]?.timezone);
        if (timezone) {
          const start = zonedMinuteToDate(filters.date, 0, timezone);
          const end = zonedMinuteToDate(filters.date, 1440, timezone);
          if (start && end) {
            conditions.push(gte(bookings.startAt, start));
            conditions.push(lt(bookings.startAt, end));
          }
        }
      }
      const ids = await database
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(...conditions))
        .orderBy(
          sql`case ${bookings.status}
            when 'checked_in' then 0
            when 'in_service' then 1
            when 'confirmed' then 2
            when 'rescheduled' then 3
            when 'initial' then 4
            else 5 end`,
          asc(bookings.startAt),
        );
      const results = await Promise.all(
        ids.map((row) => getBooking(actor.shopId, row.id)),
      );
      return results.filter(
        (booking): booking is BookingView => booking !== null,
      );
    },
    async createStaff(actor, input) {
      const customer = await customerService.get(
        actor.shopId,
        input.customerId,
      );
      if (!customer)
        throw new BookingDomainError('NOT_FOUND', 'Customer not found.', 404);
      const interval = await requireAvailable(actor.shopId, input);
      return insertBooking({
        shopId: actor.shopId,
        customerId: customer.id,
        selection: input,
        ...interval,
        source: 'staff',
        actorStaffUserId: actor.id,
        notes: input.notes,
      });
    },
    async createWalkIn(actor, input) {
      const customer = await customerService.get(
        actor.shopId,
        input.customerId,
      );
      if (!customer)
        throw new BookingDomainError('NOT_FOUND', 'Customer not found.', 404);
      const interval = await requireAvailable(actor.shopId, input);
      return insertBooking({
        shopId: actor.shopId,
        customerId: customer.id,
        selection: input,
        ...interval,
        source: 'walk_in',
        actorStaffUserId: actor.id,
        notes: input.notes,
        status: 'confirmed',
      });
    },
    async createPublic(input) {
      const service = await database
        .select({ shopId: services.shopId })
        .from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.active, true)))
        .limit(1)
        .then((rows) => rows[0]);
      if (!service)
        throw new BookingDomainError(
          'BOOKING_OPTION_INVALID',
          'The selected service is inactive or invalid.',
          400,
        );
      const interval = await requireAvailable(service.shopId, input);
      const customer = await customerService.create(service.shopId, {
        ...input.customer,
        notes: '',
      });
      return insertBooking({
        shopId: service.shopId,
        customerId: customer.customer.id,
        selection: input,
        ...interval,
        source: 'public',
        actorStaffUserId: null,
        notes: '',
      });
    },
    confirm: (actor, id) => transition(actor, id, 'confirmed'),
    cancel: (actor, id) => transition(actor, id, 'cancelled'),
    checkIn: (actor, id) => operationalTransition(actor, id, 'checked_in'),
    startService: (actor, id) => operationalTransition(actor, id, 'in_service'),
    complete: (actor, id) => operationalTransition(actor, id, 'completed'),
    markNoShow: (actor, id) => operationalTransition(actor, id, 'no_show'),
    async reschedule(actor, id, input) {
      const existing = await getBooking(actor.shopId, id);
      if (!existing)
        throw new BookingDomainError('NOT_FOUND', 'Booking not found.', 404);
      if (existing.status === 'cancelled')
        throw new BookingDomainError(
          'BOOKING_TRANSITION_INVALID',
          'A cancelled booking cannot be rescheduled.',
          409,
        );
      const interval = await requireAvailable(actor.shopId, input, id);
      try {
        await database.transaction(async (transaction) => {
          const changed = await transaction
            .update(bookings)
            .set({
              serviceId: input.serviceId,
              barberId: input.barberId,
              ...interval,
              status: 'rescheduled',
              updatedAt: new Date(),
            })
            .where(
              and(eq(bookings.id, id), eq(bookings.status, existing.status)),
            )
            .returning({ id: bookings.id });
          if (!changed.length)
            throw new BookingDomainError(
              'BOOKING_TRANSITION_INVALID',
              'The booking changed while this request was being processed.',
              409,
            );
          await transaction.insert(bookingEvents).values({
            bookingId: id,
            actorStaffUserId: actor.id,
            fromStatus: existing.status,
            toStatus: 'rescheduled',
          });
          await transaction.insert(auditLogs).values({
            actorStaffUserId: actor.id,
            action: 'booking_rescheduled',
            entityType: 'booking',
            entityId: id,
          });
        });
      } catch (error) {
        if (hasDatabaseCode(error, '23P01'))
          throw new BookingDomainError(
            'BOOKING_TIME_UNAVAILABLE',
            'The selected time was just reserved by another booking.',
            409,
          );
        throw error;
      }
      const booking = await getBooking(actor.shopId, id);
      if (!booking) throw new Error('Rescheduled booking was not found.');
      return booking;
    },
    async getPublicOptions() {
      const shop = await database
        .select({
          id: shops.id,
          name: shops.name,
          phone: shops.phone,
          email: shops.email,
          address: shops.address,
          timezone: shops.timezone,
        })
        .from(shops)
        .limit(1)
        .then((rows) => rows[0]);
      if (!shop) return null;
      const [activeServices, activeBarbers] = await Promise.all([
        database
          .select({
            id: services.id,
            name: services.name,
            description: services.description,
            durationMinutes: services.durationMinutes,
            priceRupiah: services.priceRupiah,
          })
          .from(services)
          .where(and(eq(services.shopId, shop.id), eq(services.active, true)))
          .orderBy(asc(services.name)),
        database
          .select({ id: barberProfiles.id, name: barberProfiles.name })
          .from(barberProfiles)
          .leftJoin(staffUsers, eq(barberProfiles.staffUserId, staffUsers.id))
          .where(
            and(
              eq(barberProfiles.shopId, shop.id),
              eq(barberProfiles.active, true),
              or(
                isNull(barberProfiles.staffUserId),
                eq(staffUsers.active, true),
              ),
            ),
          )
          .orderBy(asc(barberProfiles.name)),
      ]);
      const assignments = activeBarbers.length
        ? await database
            .select()
            .from(barberServices)
            .where(
              inArray(
                barberServices.barberId,
                activeBarbers.map((barber) => barber.id),
              ),
            )
        : [];
      return {
        shop,
        services: activeServices,
        barbers: activeBarbers.map((barber) => ({
          ...barber,
          serviceIds: assignments
            .filter((assignment) => assignment.barberId === barber.id)
            .map((assignment) => assignment.serviceId),
        })),
      };
    },
    async findPublicAvailability(input) {
      const service = await database
        .select({ shopId: services.shopId })
        .from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.active, true)))
        .limit(1)
        .then((rows) => rows[0]);
      if (!service) return null;
      return availabilityService.findSlots({
        shopId: service.shopId,
        serviceId: input.serviceId,
        barberId: input.barberId,
        date: input.date,
        intervalMinutes: 15,
      });
    },
  };
}
