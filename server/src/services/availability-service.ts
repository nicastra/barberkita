import { and, eq, inArray, isNull, or } from 'drizzle-orm';

import type { Database } from '../db/client';
import {
  barberBreaks,
  barberProfiles,
  barberScheduleExceptions,
  barberServices,
  barberWorkingHours,
  services,
  shops,
  staffUsers,
} from '../db/schema';

type MinuteRange = { start: number; end: number };

export type ReservationInterval = {
  barberId: string;
  startAt: Date;
  endAt: Date;
};

export interface ReservationSource {
  listBetween(
    barberIds: string[],
    startAt: Date,
    endAt: Date,
    excludeReservationId?: string | undefined,
  ): Promise<ReservationInterval[]>;
}

export type AvailabilitySlot = {
  barberId: string;
  barberName: string;
  startAt: string;
  endAt: string;
};

export type AvailabilityResult = {
  date: string;
  timezone: string;
  service: { id: string; durationMinutes: number };
  slots: AvailabilitySlot[];
};

export interface AvailabilityService {
  findSlots(input: {
    shopId: string;
    serviceId: string;
    barberId?: string | undefined;
    date: string;
    intervalMinutes: number;
    excludeReservationId?: string | undefined;
  }): Promise<AvailabilityResult | null>;
}

const noReservations: ReservationSource = {
  listBetween: async () => [],
};

function dateParts(value: string): [number, number, number] {
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  return [year, month, day];
}

function addDays(value: string, days: number): string {
  const [year, month, day] = dateParts(value);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function localParts(date: Date, timezone: string) {
  const values = new Map(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.get('year') ?? 0,
    month: values.get('month') ?? 0,
    day: values.get('day') ?? 0,
    hour: values.get('hour') ?? 0,
    minute: values.get('minute') ?? 0,
    second: values.get('second') ?? 0,
  };
}

export function localDateForInstant(date: Date, timezone: string): string {
  const parts = localParts(date, timezone);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function zonedMinuteToDate(
  localDate: string,
  minuteOfDay: number,
  timezone: string,
): Date | null {
  const normalizedDate =
    minuteOfDay === 1440 ? addDays(localDate, 1) : localDate;
  const normalizedMinute = minuteOfDay === 1440 ? 0 : minuteOfDay;
  const [year, month, day] = dateParts(normalizedDate);
  const hour = Math.floor(normalizedMinute / 60);
  const minute = normalizedMinute % 60;
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const actual = localParts(new Date(guess), timezone);
    const represented = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    guess += target - represented;
  }
  const result = new Date(guess);
  const actual = localParts(result, timezone);
  return actual.year === year &&
    actual.month === month &&
    actual.day === day &&
    actual.hour === hour &&
    actual.minute === minute
    ? result
    : null;
}

export function subtractRanges(
  source: MinuteRange[],
  blocks: MinuteRange[],
): MinuteRange[] {
  const normalized = [...source]
    .sort((left, right) => left.start - right.start)
    .reduce<MinuteRange[]>((ranges, range) => {
      const previous = ranges.at(-1);
      if (previous && range.start <= previous.end) {
        previous.end = Math.max(previous.end, range.end);
      } else {
        ranges.push({ ...range });
      }
      return ranges;
    }, []);
  return blocks.reduce<MinuteRange[]>((current, block) => {
    return current.flatMap((range) => {
      if (block.end <= range.start || block.start >= range.end) return [range];
      const result: MinuteRange[] = [];
      if (block.start > range.start)
        result.push({ start: range.start, end: block.start });
      if (block.end < range.end)
        result.push({ start: block.end, end: range.end });
      return result;
    });
  }, normalized);
}

export function overlapsReservation(
  barberId: string,
  startAt: Date,
  endAt: Date,
  reservations: ReservationInterval[],
): boolean {
  return reservations.some(
    (reservation) =>
      reservation.barberId === barberId &&
      reservation.startAt < endAt &&
      reservation.endAt > startAt,
  );
}

export function createAvailabilityService(
  database: Database,
  reservations: ReservationSource = noReservations,
  now: () => Date = () => new Date(),
): AvailabilityService {
  return {
    async findSlots(input) {
      const service = await database
        .select({
          id: services.id,
          durationMinutes: services.durationMinutes,
          timezone: shops.timezone,
        })
        .from(services)
        .innerJoin(shops, eq(services.shopId, shops.id))
        .where(
          and(
            eq(services.id, input.serviceId),
            eq(services.shopId, input.shopId),
            eq(services.active, true),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);
      if (!service) return null;

      const eligibilityConditions = [
        eq(barberServices.serviceId, input.serviceId),
        eq(barberProfiles.shopId, input.shopId),
        eq(barberProfiles.active, true),
        or(isNull(barberProfiles.staffUserId), eq(staffUsers.active, true))!,
      ];
      if (input.barberId)
        eligibilityConditions.push(eq(barberProfiles.id, input.barberId));
      const barbers = await database
        .select({ id: barberProfiles.id, name: barberProfiles.name })
        .from(barberProfiles)
        .innerJoin(
          barberServices,
          eq(barberProfiles.id, barberServices.barberId),
        )
        .leftJoin(staffUsers, eq(barberProfiles.staffUserId, staffUsers.id))
        .where(and(...eligibilityConditions));
      if (barbers.length === 0)
        return {
          date: input.date,
          timezone: service.timezone,
          service: {
            id: service.id,
            durationMinutes: service.durationMinutes,
          },
          slots: [],
        };

      const barberIds = barbers.map((barber) => barber.id);
      const dayOfWeek = new Date(`${input.date}T00:00:00Z`).getUTCDay();
      const [hours, breaks, exceptions] = await Promise.all([
        database
          .select()
          .from(barberWorkingHours)
          .where(
            and(
              inArray(barberWorkingHours.barberId, barberIds),
              eq(barberWorkingHours.dayOfWeek, dayOfWeek),
            ),
          ),
        database
          .select()
          .from(barberBreaks)
          .where(
            and(
              inArray(barberBreaks.barberId, barberIds),
              eq(barberBreaks.dayOfWeek, dayOfWeek),
            ),
          ),
        database
          .select()
          .from(barberScheduleExceptions)
          .where(
            and(
              inArray(barberScheduleExceptions.barberId, barberIds),
              eq(barberScheduleExceptions.date, input.date),
            ),
          ),
      ]);
      const dayStart = zonedMinuteToDate(input.date, 0, service.timezone);
      const dayEnd = zonedMinuteToDate(input.date, 1440, service.timezone);
      if (!dayStart || !dayEnd)
        throw new Error(`Could not interpret date in ${service.timezone}.`);
      const reserved = await reservations.listBetween(
        barberIds,
        dayStart,
        dayEnd,
        input.excludeReservationId,
      );

      const slots: AvailabilitySlot[] = [];
      for (const barber of barbers) {
        const dated = exceptions.filter(
          (exception) => exception.barberId === barber.id,
        );
        const addedHours = dated.filter(
          (exception) => exception.kind === 'available',
        );
        const base: MinuteRange[] = (
          addedHours.length
            ? addedHours
            : hours.filter((hour) => hour.barberId === barber.id)
        ).map((range) => ({
          start: range.startMinute ?? 0,
          end: range.endMinute ?? 1440,
        }));
        const unavailable: MinuteRange[] = dated
          .filter((exception) => exception.kind === 'unavailable')
          .map((exception) => ({
            start: exception.startMinute ?? 0,
            end: exception.endMinute ?? 1440,
          }));
        const recurringBreaks = breaks
          .filter((item) => item.barberId === barber.id)
          .map((item) => ({
            start: item.startMinute,
            end: item.endMinute,
          }));
        const openRanges = subtractRanges(base, [
          ...recurringBreaks,
          ...unavailable,
        ]);

        for (const range of openRanges) {
          for (
            let startMinute = range.start;
            startMinute + service.durationMinutes <= range.end;
            startMinute += input.intervalMinutes
          ) {
            const endMinute = startMinute + service.durationMinutes;
            const startAt = zonedMinuteToDate(
              input.date,
              startMinute,
              service.timezone,
            );
            const endAt = zonedMinuteToDate(
              input.date,
              endMinute,
              service.timezone,
            );
            if (!startAt || !endAt) continue;
            if (startAt <= now()) continue;
            const conflicts = overlapsReservation(
              barber.id,
              startAt,
              endAt,
              reserved,
            );
            if (!conflicts)
              slots.push({
                barberId: barber.id,
                barberName: barber.name,
                startAt: startAt.toISOString(),
                endAt: endAt.toISOString(),
              });
          }
        }
      }
      slots.sort(
        (left, right) =>
          left.startAt.localeCompare(right.startAt) ||
          left.barberName.localeCompare(right.barberName),
      );
      return {
        date: input.date,
        timezone: service.timezone,
        service: {
          id: service.id,
          durationMinutes: service.durationMinutes,
        },
        slots,
      };
    },
  };
}
