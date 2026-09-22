import { z } from 'zod';

import { availabilitySchema } from './catalog';
import { apiRequest, scopedShopPath } from './client';
import { customerSchema } from './customers';

const bookingStatusSchema = z.enum([
  'initial',
  'confirmed',
  'rescheduled',
  'checked_in',
  'in_service',
  'completed',
  'cancelled',
  'no_show',
]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const bookingSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  customerId: z.string().uuid(),
  serviceId: z.string().uuid(),
  barberId: z.string().uuid(),
  createdByStaffUserId: z.string().uuid().nullable(),
  startAt: z.string(),
  endAt: z.string(),
  status: bookingStatusSchema,
  source: z.enum(['staff', 'public', 'walk_in']),
  confirmationCode: z.string(),
  notes: z.string(),
  checkedInAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  noShowAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  customer: customerSchema.pick({
    id: true,
    name: true,
    phone: true,
    email: true,
  }),
  service: z.object({
    id: z.string().uuid(),
    name: z.string(),
    durationMinutes: z.number().int().positive(),
    priceRupiah: z.number().int().nonnegative(),
  }),
  barber: z.object({ id: z.string().uuid(), name: z.string() }),
  shop: z.object({
    id: z.string().uuid(),
    name: z.string(),
    phone: z.string(),
    email: z.string().email(),
    address: z.string(),
    timezone: z.string(),
  }),
});
export type Booking = z.infer<typeof bookingSchema>;

const bookingResponseSchema = z.object({ booking: bookingSchema });

export const publicOptionsSchema = z.object({
  shop: bookingSchema.shape.shop,
  services: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      description: z.string(),
      durationMinutes: z.number().int().positive(),
      priceRupiah: z.number().int().nonnegative(),
    }),
  ),
  barbers: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      serviceIds: z.array(z.string().uuid()),
    }),
  ),
});
export type PublicOptions = z.infer<typeof publicOptionsSchema>;

export type BookingSelection = {
  serviceId: string;
  barberId: string;
  startAt: string;
};

export function listBookings(filters?: {
  customerId?: string;
  barberId?: string;
  status?: z.infer<typeof bookingStatusSchema>;
  date?: string;
}) {
  const query = new URLSearchParams();
  if (filters?.customerId) query.set('customerId', filters.customerId);
  if (filters?.barberId) query.set('barberId', filters.barberId);
  if (filters?.status) query.set('status', filters.status);
  if (filters?.date) query.set('date', filters.date);
  const suffix = query.size ? `?${query.toString()}` : '';
  return apiRequest(scopedShopPath(`/bookings${suffix}`), {
    schema: z.object({ bookings: z.array(bookingSchema) }),
  });
}

export function createStaffBooking(
  input: BookingSelection & { customerId: string; notes: string },
) {
  return apiRequest(scopedShopPath('/bookings'), {
    method: 'POST',
    body: input,
    schema: bookingResponseSchema,
  });
}

export function createWalkInBooking(
  input: BookingSelection & { customerId: string; notes: string },
) {
  return apiRequest(scopedShopPath('/bookings/walk-ins'), {
    method: 'POST',
    body: input,
    schema: bookingResponseSchema,
  });
}

export function confirmBooking(id: string) {
  return apiRequest(scopedShopPath(`/bookings/${id}/confirm`), {
    method: 'POST',
    schema: bookingResponseSchema,
  });
}

export function cancelBooking(id: string) {
  return apiRequest(scopedShopPath(`/bookings/${id}/cancel`), {
    method: 'POST',
    schema: bookingResponseSchema,
  });
}

function operationalAction(
  id: string,
  action: 'check-in' | 'start' | 'complete' | 'no-show',
) {
  return apiRequest(scopedShopPath(`/bookings/${id}/${action}`), {
    method: 'POST',
    schema: bookingResponseSchema,
  });
}

export const checkInBooking = (id: string) => operationalAction(id, 'check-in');
export const startBooking = (id: string) => operationalAction(id, 'start');
export const completeBooking = (id: string) =>
  operationalAction(id, 'complete');
export const markNoShow = (id: string) => operationalAction(id, 'no-show');

export function rescheduleBooking(id: string, input: BookingSelection) {
  return apiRequest(scopedShopPath(`/bookings/${id}/reschedule`), {
    method: 'PATCH',
    body: input,
    schema: bookingResponseSchema,
  });
}

export function getPublicOptions(shopSlug: string) {
  const path = `/api/public/shops/${encodeURIComponent(shopSlug)}/options`;
  return apiRequest(path, {
    schema: z.object({ options: publicOptionsSchema }),
  });
}

export function getPublicAvailability(input: {
  shopSlug: string;
  serviceId: string;
  date: string;
  barberId?: string;
}) {
  const query = new URLSearchParams({
    serviceId: input.serviceId,
    date: input.date,
  });
  if (input.barberId) query.set('barberId', input.barberId);
  const path = `/api/public/shops/${encodeURIComponent(input.shopSlug)}/availability?${query.toString()}`;
  return apiRequest(path, {
    schema: z.object({ availability: availabilitySchema }),
  });
}

export function createPublicBooking(
  input: BookingSelection & {
    shopSlug: string;
    customer: { name: string; phone: string; email: string | null };
  },
) {
  const path = `/api/public/shops/${encodeURIComponent(input.shopSlug)}/bookings`;
  return apiRequest(path, {
    method: 'POST',
    body: input,
    schema: bookingResponseSchema,
  });
}
