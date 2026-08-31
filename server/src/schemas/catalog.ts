import { z } from 'zod';

const timeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour HH:MM time');

const dateSchema = z.iso.date();

export const resourceIdSchema = z.object({ id: z.string().uuid() });

export const createServiceSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1_000).default(''),
  durationMinutes: z
    .number()
    .int()
    .positive()
    .max(12 * 60),
  priceRupiah: z.number().int().nonnegative().max(2_000_000_000),
  active: z.boolean().default(true),
});

export const updateServiceSchema = createServiceSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one service field is required',
  });

export const createBarberSchema = z.object({
  name: z.string().trim().min(1).max(120),
  staffUserId: z.string().uuid().nullable().default(null),
  active: z.boolean().default(true),
});

export const updateBarberSchema = createBarberSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one barber field is required',
  });

export const serviceAssignmentsSchema = z.object({
  serviceIds: z.array(z.string().uuid()).max(200),
});

const weeklyRangeSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: timeSchema,
    endTime: timeSchema,
  })
  .refine((value) => value.startTime < value.endTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

export const replaceWorkingHoursSchema = z.object({
  hours: z.array(weeklyRangeSchema).max(100),
});

export const replaceBreaksSchema = z.object({
  breaks: z.array(weeklyRangeSchema).max(100),
});

const exceptionFieldsSchema = z
  .object({
    date: dateSchema,
    kind: z.enum(['available', 'unavailable']),
    startTime: timeSchema.nullable().default(null),
    endTime: timeSchema.nullable().default(null),
    note: z.string().trim().max(500).default(''),
  })
  .refine(
    (value) =>
      (value.startTime === null && value.endTime === null) ||
      (value.startTime !== null &&
        value.endTime !== null &&
        value.startTime < value.endTime),
    {
      message: 'Provide both times with an end after the start, or neither',
      path: ['endTime'],
    },
  );

export const createScheduleExceptionSchema = exceptionFieldsSchema;

export const updateScheduleExceptionSchema = exceptionFieldsSchema;

export const exceptionParamsSchema = z.object({
  id: z.string().uuid(),
  exceptionId: z.string().uuid(),
});

export const availabilityQuerySchema = z.object({
  serviceId: z.string().uuid(),
  date: dateSchema,
  barberId: z.string().uuid().optional(),
  intervalMinutes: z.coerce.number().int().min(5).max(60).default(15),
});

export type WeeklyRangeInput = z.infer<typeof weeklyRangeSchema>;
export type ScheduleExceptionInput = z.infer<
  typeof createScheduleExceptionSchema
>;
