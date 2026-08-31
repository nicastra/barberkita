import { and, asc, eq, inArray } from 'drizzle-orm';

import type { Database } from '../db/client';
import {
  auditLogs,
  barberBreaks,
  barberProfiles,
  barberScheduleExceptions,
  barberServices,
  barberWorkingHours,
  services,
  staffUsers,
} from '../db/schema';
import type {
  ScheduleExceptionInput,
  WeeklyRangeInput,
} from '../schemas/catalog';
import type { AuthUser } from './auth-service';

export type ServiceInput = {
  name: string;
  description: string;
  durationMinutes: number;
  priceRupiah: number;
  active: boolean;
};

export type BarberInput = {
  name: string;
  staffUserId: string | null;
  active: boolean;
};

type ServiceUpdate = {
  [Key in keyof ServiceInput]?: ServiceInput[Key] | undefined;
};

type BarberUpdate = {
  [Key in keyof BarberInput]?: BarberInput[Key] | undefined;
};

export type BarberView = typeof barberProfiles.$inferSelect & {
  serviceIds: string[];
};

export type ScheduleRange = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type ScheduleExceptionView = {
  id: string;
  date: string;
  kind: 'available' | 'unavailable';
  startTime: string | null;
  endTime: string | null;
  note: string;
};

export type BarberSchedule = {
  hours: ScheduleRange[];
  breaks: ScheduleRange[];
  exceptions: ScheduleExceptionView[];
};

export class CatalogConflictError extends Error {}

export interface CatalogService {
  listServices(shopId: string): Promise<(typeof services.$inferSelect)[]>;
  createService(
    actor: AuthUser,
    input: ServiceInput,
  ): Promise<typeof services.$inferSelect>;
  updateService(
    actor: AuthUser,
    id: string,
    input: ServiceUpdate,
  ): Promise<typeof services.$inferSelect | null>;
  listBarbers(shopId: string): Promise<BarberView[]>;
  createBarber(actor: AuthUser, input: BarberInput): Promise<BarberView>;
  updateBarber(
    actor: AuthUser,
    id: string,
    input: BarberUpdate,
  ): Promise<BarberView | null>;
  assignServices(
    actor: AuthUser,
    barberId: string,
    serviceIds: string[],
  ): Promise<BarberView | null>;
  getSchedule(shopId: string, barberId: string): Promise<BarberSchedule | null>;
  replaceWorkingHours(
    actor: AuthUser,
    barberId: string,
    hours: WeeklyRangeInput[],
  ): Promise<BarberSchedule | null>;
  replaceBreaks(
    actor: AuthUser,
    barberId: string,
    breaks: WeeklyRangeInput[],
  ): Promise<BarberSchedule | null>;
  createException(
    actor: AuthUser,
    barberId: string,
    input: ScheduleExceptionInput,
  ): Promise<ScheduleExceptionView | null>;
  updateException(
    actor: AuthUser,
    barberId: string,
    exceptionId: string,
    input: Partial<ScheduleExceptionInput>,
  ): Promise<ScheduleExceptionView | null>;
  deleteException(
    actor: AuthUser,
    barberId: string,
    exceptionId: string,
  ): Promise<boolean>;
}

function timeToMinute(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function minuteToTime(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function scheduleRange(row: {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}): ScheduleRange {
  return {
    id: row.id,
    dayOfWeek: row.dayOfWeek,
    startTime: minuteToTime(row.startMinute),
    endTime: minuteToTime(row.endMinute),
  };
}

function exceptionView(
  row: typeof barberScheduleExceptions.$inferSelect,
): ScheduleExceptionView {
  return {
    id: row.id,
    date: row.date,
    kind: row.kind,
    startTime: row.startMinute === null ? null : minuteToTime(row.startMinute),
    endTime: row.endMinute === null ? null : minuteToTime(row.endMinute),
    note: row.note,
  };
}

function assertNoOverlaps(ranges: WeeklyRangeInput[], label: string): void {
  const byDay = new Map<number, { start: number; end: number }[]>();
  for (const range of ranges) {
    const current = byDay.get(range.dayOfWeek) ?? [];
    current.push({
      start: timeToMinute(range.startTime),
      end: timeToMinute(range.endTime),
    });
    byDay.set(range.dayOfWeek, current);
  }
  for (const values of byDay.values()) {
    values.sort((left, right) => left.start - right.start);
    if (
      values.some(
        (value, index) => index > 0 && value.start < values[index - 1]!.end,
      )
    )
      throw new CatalogConflictError(`${label} cannot overlap.`);
  }
}

export function createCatalogService(database: Database): CatalogService {
  async function barberExists(shopId: string, barberId: string) {
    return database
      .select({ id: barberProfiles.id })
      .from(barberProfiles)
      .where(
        and(eq(barberProfiles.id, barberId), eq(barberProfiles.shopId, shopId)),
      )
      .limit(1)
      .then((rows) => Boolean(rows[0]));
  }

  async function validateStaff(shopId: string, staffUserId: string | null) {
    if (staffUserId === null) return;
    const staff = await database
      .select({ id: staffUsers.id })
      .from(staffUsers)
      .where(
        and(
          eq(staffUsers.id, staffUserId),
          eq(staffUsers.shopId, shopId),
          eq(staffUsers.active, true),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);
    if (!staff)
      throw new CatalogConflictError('The linked staff account is invalid.');
  }

  async function getBarber(
    shopId: string,
    id: string,
  ): Promise<BarberView | null> {
    const barber = await database
      .select()
      .from(barberProfiles)
      .where(and(eq(barberProfiles.id, id), eq(barberProfiles.shopId, shopId)))
      .limit(1)
      .then((rows) => rows[0]);
    if (!barber) return null;
    const assigned = await database
      .select({ serviceId: barberServices.serviceId })
      .from(barberServices)
      .where(eq(barberServices.barberId, id));
    return { ...barber, serviceIds: assigned.map((row) => row.serviceId) };
  }

  async function getSchedule(
    shopId: string,
    barberId: string,
  ): Promise<BarberSchedule | null> {
    if (!(await barberExists(shopId, barberId))) return null;
    const [hours, breaks, exceptions] = await Promise.all([
      database
        .select()
        .from(barberWorkingHours)
        .where(eq(barberWorkingHours.barberId, barberId))
        .orderBy(
          asc(barberWorkingHours.dayOfWeek),
          asc(barberWorkingHours.startMinute),
        ),
      database
        .select()
        .from(barberBreaks)
        .where(eq(barberBreaks.barberId, barberId))
        .orderBy(asc(barberBreaks.dayOfWeek), asc(barberBreaks.startMinute)),
      database
        .select()
        .from(barberScheduleExceptions)
        .where(eq(barberScheduleExceptions.barberId, barberId))
        .orderBy(asc(barberScheduleExceptions.date)),
    ]);
    return {
      hours: hours.map(scheduleRange),
      breaks: breaks.map(scheduleRange),
      exceptions: exceptions.map(exceptionView),
    };
  }

  return {
    async listServices(shopId) {
      return database
        .select()
        .from(services)
        .where(eq(services.shopId, shopId))
        .orderBy(asc(services.name));
    },
    async createService(actor, input) {
      const [service] = await database
        .insert(services)
        .values({ shopId: actor.shopId, ...input })
        .returning();
      if (!service) throw new Error('Service creation failed.');
      await database.insert(auditLogs).values({
        actorStaffUserId: actor.id,
        action: 'service_created',
        entityType: 'service',
        entityId: service.id,
      });
      return service;
    },
    async updateService(actor, id, input) {
      const [service] = await database
        .update(services)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(services.id, id), eq(services.shopId, actor.shopId)))
        .returning();
      if (!service) return null;
      await database.insert(auditLogs).values({
        actorStaffUserId: actor.id,
        action: 'service_updated',
        entityType: 'service',
        entityId: id,
      });
      return service;
    },
    async listBarbers(shopId) {
      const rows = await database
        .select()
        .from(barberProfiles)
        .where(eq(barberProfiles.shopId, shopId))
        .orderBy(asc(barberProfiles.name));
      if (rows.length === 0) return [];
      const assigned = await database
        .select()
        .from(barberServices)
        .where(
          inArray(
            barberServices.barberId,
            rows.map((row) => row.id),
          ),
        );
      return rows.map((row) => ({
        ...row,
        serviceIds: assigned
          .filter((item) => item.barberId === row.id)
          .map((item) => item.serviceId),
      }));
    },
    async createBarber(actor, input) {
      await validateStaff(actor.shopId, input.staffUserId);
      try {
        const [barber] = await database
          .insert(barberProfiles)
          .values({ shopId: actor.shopId, ...input })
          .returning();
        if (!barber) throw new Error('Barber creation failed.');
        await database.insert(auditLogs).values({
          actorStaffUserId: actor.id,
          action: 'barber_created',
          entityType: 'barber_profile',
          entityId: barber.id,
        });
        return { ...barber, serviceIds: [] };
      } catch (error) {
        if (error instanceof CatalogConflictError) throw error;
        if (String(error).includes('barber_profiles_staff_user_id_unique'))
          throw new CatalogConflictError(
            'That staff account already has a barber profile.',
          );
        throw error;
      }
    },
    async updateBarber(actor, id, input) {
      if (input.staffUserId !== undefined)
        await validateStaff(actor.shopId, input.staffUserId);
      try {
        const [barber] = await database
          .update(barberProfiles)
          .set({ ...input, updatedAt: new Date() })
          .where(
            and(
              eq(barberProfiles.id, id),
              eq(barberProfiles.shopId, actor.shopId),
            ),
          )
          .returning();
        if (!barber) return null;
        await database.insert(auditLogs).values({
          actorStaffUserId: actor.id,
          action: 'barber_updated',
          entityType: 'barber_profile',
          entityId: id,
        });
        return getBarber(actor.shopId, id);
      } catch (error) {
        if (error instanceof CatalogConflictError) throw error;
        if (String(error).includes('barber_profiles_staff_user_id_unique'))
          throw new CatalogConflictError(
            'That staff account already has a barber profile.',
          );
        throw error;
      }
    },
    async assignServices(actor, barberId, serviceIds) {
      if (!(await barberExists(actor.shopId, barberId))) return null;
      const uniqueIds = [...new Set(serviceIds)];
      if (uniqueIds.length) {
        const owned = await database
          .select({ id: services.id })
          .from(services)
          .where(
            and(
              eq(services.shopId, actor.shopId),
              inArray(services.id, uniqueIds),
            ),
          );
        if (owned.length !== uniqueIds.length)
          throw new CatalogConflictError(
            'Every assigned service must belong to this shop.',
          );
      }
      await database.transaction(async (transaction) => {
        await transaction
          .delete(barberServices)
          .where(eq(barberServices.barberId, barberId));
        if (uniqueIds.length)
          await transaction
            .insert(barberServices)
            .values(uniqueIds.map((serviceId) => ({ barberId, serviceId })));
        await transaction.insert(auditLogs).values({
          actorStaffUserId: actor.id,
          action: 'barber_services_updated',
          entityType: 'barber_profile',
          entityId: barberId,
        });
      });
      return getBarber(actor.shopId, barberId);
    },
    getSchedule,
    async replaceWorkingHours(actor, barberId, hours) {
      if (!(await barberExists(actor.shopId, barberId))) return null;
      assertNoOverlaps(hours, 'Working hours');
      await database.transaction(async (transaction) => {
        await transaction
          .delete(barberWorkingHours)
          .where(eq(barberWorkingHours.barberId, barberId));
        if (hours.length)
          await transaction.insert(barberWorkingHours).values(
            hours.map((range) => ({
              barberId,
              dayOfWeek: range.dayOfWeek,
              startMinute: timeToMinute(range.startTime),
              endMinute: timeToMinute(range.endTime),
            })),
          );
        await transaction.insert(auditLogs).values({
          actorStaffUserId: actor.id,
          action: 'barber_working_hours_updated',
          entityType: 'barber_profile',
          entityId: barberId,
        });
      });
      return getSchedule(actor.shopId, barberId);
    },
    async replaceBreaks(actor, barberId, breaks) {
      if (!(await barberExists(actor.shopId, barberId))) return null;
      assertNoOverlaps(breaks, 'Breaks');
      await database.transaction(async (transaction) => {
        await transaction
          .delete(barberBreaks)
          .where(eq(barberBreaks.barberId, barberId));
        if (breaks.length)
          await transaction.insert(barberBreaks).values(
            breaks.map((range) => ({
              barberId,
              dayOfWeek: range.dayOfWeek,
              startMinute: timeToMinute(range.startTime),
              endMinute: timeToMinute(range.endTime),
            })),
          );
        await transaction.insert(auditLogs).values({
          actorStaffUserId: actor.id,
          action: 'barber_breaks_updated',
          entityType: 'barber_profile',
          entityId: barberId,
        });
      });
      return getSchedule(actor.shopId, barberId);
    },
    async createException(actor, barberId, input) {
      if (!(await barberExists(actor.shopId, barberId))) return null;
      const [exception] = await database
        .insert(barberScheduleExceptions)
        .values({
          barberId,
          date: input.date,
          kind: input.kind,
          startMinute:
            input.startTime === null ? null : timeToMinute(input.startTime),
          endMinute:
            input.endTime === null ? null : timeToMinute(input.endTime),
          note: input.note,
        })
        .returning();
      if (!exception) throw new Error('Schedule exception creation failed.');
      await database.insert(auditLogs).values({
        actorStaffUserId: actor.id,
        action: 'barber_exception_created',
        entityType: 'schedule_exception',
        entityId: exception.id,
      });
      return exceptionView(exception);
    },
    async updateException(actor, barberId, exceptionId, input) {
      if (!(await barberExists(actor.shopId, barberId))) return null;
      const update: Partial<typeof barberScheduleExceptions.$inferInsert> = {};
      if (input.date !== undefined) update.date = input.date;
      if (input.kind !== undefined) update.kind = input.kind;
      if (input.startTime !== undefined)
        update.startMinute =
          input.startTime === null ? null : timeToMinute(input.startTime);
      if (input.endTime !== undefined)
        update.endMinute =
          input.endTime === null ? null : timeToMinute(input.endTime);
      if (input.note !== undefined) update.note = input.note;
      const [exception] = await database
        .update(barberScheduleExceptions)
        .set(update)
        .where(
          and(
            eq(barberScheduleExceptions.id, exceptionId),
            eq(barberScheduleExceptions.barberId, barberId),
          ),
        )
        .returning();
      if (!exception) return null;
      await database.insert(auditLogs).values({
        actorStaffUserId: actor.id,
        action: 'barber_exception_updated',
        entityType: 'schedule_exception',
        entityId: exceptionId,
      });
      return exceptionView(exception);
    },
    async deleteException(actor, barberId, exceptionId) {
      if (!(await barberExists(actor.shopId, barberId))) return false;
      const deleted = await database
        .delete(barberScheduleExceptions)
        .where(
          and(
            eq(barberScheduleExceptions.id, exceptionId),
            eq(barberScheduleExceptions.barberId, barberId),
          ),
        )
        .returning({ id: barberScheduleExceptions.id });
      if (!deleted.length) return false;
      await database.insert(auditLogs).values({
        actorStaffUserId: actor.id,
        action: 'barber_exception_deleted',
        entityType: 'schedule_exception',
        entityId: exceptionId,
      });
      return true;
    },
  };
}
