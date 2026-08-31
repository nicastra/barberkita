import { z } from 'zod';

import { apiRequest } from './client';

const correctionSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['refund', 'void']),
  amountRupiah: z.number().int().positive(),
  reason: z.string(),
  recordedByStaffUserId: z.string().uuid().nullable(),
  createdAt: z.string(),
});

const paymentSchema = z.object({
  id: z.string().uuid(),
  amountRupiah: z.number().int().positive(),
  method: z.enum(['cash', 'card', 'bank_transfer', 'qris']),
  reference: z.string(),
  idempotencyKey: z.string().uuid(),
  recordedByStaffUserId: z.string().uuid().nullable(),
  createdAt: z.string(),
  correctedRupiah: z.number().int().nonnegative(),
  netAmountRupiah: z.number().int(),
  corrections: z.array(correctionSchema),
});

export const checkoutSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  bookingId: z.string().uuid(),
  customerId: z.string().uuid(),
  barberId: z.string().uuid(),
  createdByStaffUserId: z.string().uuid().nullable(),
  receiptNumber: z.string(),
  subtotalRupiah: z.number().int().nonnegative(),
  discountRupiah: z.number().int().nonnegative(),
  totalRupiah: z.number().int().nonnegative(),
  adjustmentReason: z.string(),
  status: z.enum(['unpaid', 'partially_paid', 'paid', 'refunded']),
  paidRupiah: z.number().int(),
  remainingRupiah: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  customer: z.object({
    id: z.string().uuid(),
    name: z.string(),
    phone: z.string(),
    email: z.string().nullable(),
  }),
  barber: z.object({ id: z.string().uuid(), name: z.string() }),
  appointment: z.object({
    startAt: z.string(),
    endAt: z.string(),
    confirmationCode: z.string(),
  }),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      serviceId: z.string().uuid().nullable(),
      description: z.string(),
      quantity: z.number().int().positive(),
      unitPriceRupiah: z.number().int().nonnegative(),
      lineTotalRupiah: z.number().int().nonnegative(),
    }),
  ),
  payments: z.array(paymentSchema),
  shop: z.object({
    id: z.string().uuid(),
    name: z.string(),
    timezone: z.string(),
  }),
});

export type Checkout = z.infer<typeof checkoutSchema>;

const checkoutResponseSchema = z.object({ checkout: checkoutSchema });

export function listCheckouts(filters?: {
  query?: string;
  status?: Checkout['status'];
}) {
  const query = new URLSearchParams();
  if (filters?.query) query.set('query', filters.query);
  if (filters?.status) query.set('status', filters.status);
  const suffix = query.size ? `?${query.toString()}` : '';
  return apiRequest(`/api/checkouts${suffix}`, {
    schema: z.object({ checkouts: z.array(checkoutSchema) }),
  });
}

export function createCheckout(input: {
  bookingId: string;
  discountRupiah: number;
  adjustmentReason: string;
}) {
  return apiRequest('/api/checkouts', {
    method: 'POST',
    body: input,
    schema: checkoutResponseSchema,
  });
}

export function recordPayment(
  id: string,
  input: {
    amountRupiah: number;
    method: 'cash' | 'card' | 'bank_transfer' | 'qris';
    reference: string;
    idempotencyKey: string;
  },
) {
  return apiRequest(`/api/checkouts/${id}/payments`, {
    method: 'POST',
    body: input,
    schema: checkoutResponseSchema,
  });
}

export function correctPayment(
  checkoutId: string,
  paymentId: string,
  input: {
    kind: 'refund' | 'void';
    amountRupiah?: number;
    reason: string;
    idempotencyKey: string;
  },
) {
  return apiRequest(
    `/api/checkouts/${checkoutId}/payments/${paymentId}/corrections`,
    {
      method: 'POST',
      body: input,
      schema: checkoutResponseSchema,
    },
  );
}
