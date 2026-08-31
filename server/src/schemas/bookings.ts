import { z } from 'zod';

const bookingSelectionSchema = z.object({
  serviceId: z.string().uuid(),
  barberId: z.string().uuid(),
  startAt: z.iso.datetime({ offset: true }),
});

export const createStaffBookingSchema = bookingSelectionSchema.extend({
  customerId: z.string().uuid(),
  notes: z.string().trim().max(2_000).default(''),
});

export const rescheduleBookingSchema = bookingSelectionSchema;

export const bookingIdSchema = z.object({ id: z.string().uuid() });

export const bookingQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  barberId: z.string().uuid().optional(),
  status: z
    .enum([
      'initial',
      'confirmed',
      'rescheduled',
      'checked_in',
      'in_service',
      'completed',
      'cancelled',
      'no_show',
    ])
    .optional(),
  date: z.iso.date().optional(),
});

export const walkInBookingSchema = z.object({
  customerId: z.string().uuid(),
  serviceId: z.string().uuid(),
  barberId: z.string().uuid(),
  startAt: z.iso.datetime({ offset: true }),
  notes: z.string().trim().max(2_000).default(''),
});

export const publicAvailabilityQuerySchema = z.object({
  serviceId: z.string().uuid(),
  date: z.iso.date(),
  barberId: z.string().uuid().optional(),
});

export const createPublicBookingSchema = bookingSelectionSchema.extend({
  customer: z.object({
    name: z.string().trim().min(1).max(160),
    phone: z
      .string()
      .trim()
      .min(6)
      .max(40)
      .regex(/^\+?[\d\s().-]+$/, 'Use a valid phone number'),
    email: z.string().trim().email().max(320).nullable().default(null),
  }),
});
