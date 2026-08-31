import { z } from 'zod';

import { apiRequest } from './client';

const serviceSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  durationMinutes: z.number().int().positive(),
  priceRupiah: z.number().int().nonnegative(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Service = z.infer<typeof serviceSchema>;

const barberSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  staffUserId: z.string().uuid().nullable(),
  name: z.string(),
  active: z.boolean(),
  serviceIds: z.array(z.string().uuid()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Barber = z.infer<typeof barberSchema>;

const scheduleRangeSchema = z.object({
  id: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
});
export type ScheduleRange = z.infer<typeof scheduleRangeSchema>;

const scheduleExceptionSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  kind: z.enum(['available', 'unavailable']),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  note: z.string(),
});
export type ScheduleException = z.infer<typeof scheduleExceptionSchema>;

const scheduleSchema = z.object({
  hours: z.array(scheduleRangeSchema),
  breaks: z.array(scheduleRangeSchema),
  exceptions: z.array(scheduleExceptionSchema),
});
export type BarberSchedule = z.infer<typeof scheduleSchema>;

const serviceResponseSchema = z.object({ service: serviceSchema });
const servicesResponseSchema = z.object({ services: z.array(serviceSchema) });
const barberResponseSchema = z.object({ barber: barberSchema });
const barbersResponseSchema = z.object({ barbers: z.array(barberSchema) });
const scheduleResponseSchema = z.object({ schedule: scheduleSchema });
const exceptionResponseSchema = z.object({
  exception: scheduleExceptionSchema,
});

export type ServiceInput = Pick<
  Service,
  'name' | 'description' | 'durationMinutes' | 'priceRupiah' | 'active'
>;

export type WeeklyRangeInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type ScheduleExceptionInput = Omit<ScheduleException, 'id'>;

export function listServices() {
  return apiRequest('/api/services', { schema: servicesResponseSchema });
}

export function createService(input: ServiceInput) {
  return apiRequest('/api/services', {
    method: 'POST',
    body: input,
    schema: serviceResponseSchema,
  });
}

export function updateService(id: string, input: Partial<ServiceInput>) {
  return apiRequest(`/api/services/${id}`, {
    method: 'PATCH',
    body: input,
    schema: serviceResponseSchema,
  });
}

export function listBarbers() {
  return apiRequest('/api/barbers', { schema: barbersResponseSchema });
}

export function createBarber(input: {
  name: string;
  staffUserId: string | null;
  active: boolean;
}) {
  return apiRequest('/api/barbers', {
    method: 'POST',
    body: input,
    schema: barberResponseSchema,
  });
}

export function updateBarber(
  id: string,
  input: { name?: string; staffUserId?: string | null; active?: boolean },
) {
  return apiRequest(`/api/barbers/${id}`, {
    method: 'PATCH',
    body: input,
    schema: barberResponseSchema,
  });
}

export function assignBarberServices(id: string, serviceIds: string[]) {
  return apiRequest(`/api/barbers/${id}/services`, {
    method: 'PUT',
    body: { serviceIds },
    schema: barberResponseSchema,
  });
}

export function getBarberSchedule(id: string) {
  return apiRequest(`/api/barbers/${id}/schedule`, {
    schema: scheduleResponseSchema,
  });
}

export function replaceWorkingHours(id: string, hours: WeeklyRangeInput[]) {
  return apiRequest(`/api/barbers/${id}/working-hours`, {
    method: 'PUT',
    body: { hours },
    schema: scheduleResponseSchema,
  });
}

export function replaceBreaks(id: string, breaks: WeeklyRangeInput[]) {
  return apiRequest(`/api/barbers/${id}/breaks`, {
    method: 'PUT',
    body: { breaks },
    schema: scheduleResponseSchema,
  });
}

export function createScheduleException(
  barberId: string,
  input: ScheduleExceptionInput,
) {
  return apiRequest(`/api/barbers/${barberId}/exceptions`, {
    method: 'POST',
    body: input,
    schema: exceptionResponseSchema,
  });
}

export function deleteScheduleException(barberId: string, exceptionId: string) {
  return apiRequest(`/api/barbers/${barberId}/exceptions/${exceptionId}`, {
    method: 'DELETE',
    acceptedStatuses: [204],
    schema: z.null(),
  });
}

export const availabilitySchema = z.object({
  date: z.string(),
  timezone: z.string(),
  service: z.object({
    id: z.string().uuid(),
    durationMinutes: z.number().int().positive(),
  }),
  slots: z.array(
    z.object({
      barberId: z.string().uuid(),
      barberName: z.string(),
      startAt: z.string(),
      endAt: z.string(),
    }),
  ),
});
export type Availability = z.infer<typeof availabilitySchema>;

export function getAvailability(input: {
  serviceId: string;
  date: string;
  barberId?: string;
}) {
  const query = new URLSearchParams({
    serviceId: input.serviceId,
    date: input.date,
  });
  if (input.barberId) query.set('barberId', input.barberId);
  return apiRequest(`/api/availability?${query.toString()}`, {
    schema: z.object({ availability: availabilitySchema }),
  });
}
