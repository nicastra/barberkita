import { z } from 'zod';

const rupiahSchema = z.number().int().min(0).max(2_000_000_000);

export const checkoutIdSchema = z.object({ id: z.uuid() });

export const checkoutPaymentParamsSchema = z.object({
  id: z.uuid(),
  paymentId: z.uuid(),
});

export const checkoutStatusSchema = z.enum([
  'unpaid',
  'partially_paid',
  'paid',
  'refunded',
]);

export const checkoutQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: checkoutStatusSchema.optional(),
});

export const createCheckoutSchema = z
  .object({
    bookingId: z.uuid(),
    discountRupiah: rupiahSchema.default(0),
    adjustmentReason: z.string().trim().max(500).default(''),
  })
  .superRefine((value, context) => {
    if (value.discountRupiah > 0 && value.adjustmentReason.length === 0)
      context.addIssue({
        code: 'custom',
        path: ['adjustmentReason'],
        message: 'An adjustment reason is required for a discount.',
      });
  });

export const recordPaymentSchema = z
  .object({
    amountRupiah: rupiahSchema.min(1),
    method: z.enum(['cash', 'card', 'bank_transfer', 'qris']),
    reference: z.string().trim().max(100).default(''),
    idempotencyKey: z.uuid(),
  })
  .superRefine((value, context) => {
    if (value.method !== 'cash' && value.reference.length === 0)
      context.addIssue({
        code: 'custom',
        path: ['reference'],
        message: 'A reference is required for non-cash payments.',
      });
  });

export const paymentCorrectionSchema = z
  .object({
    kind: z.enum(['refund', 'void']),
    amountRupiah: rupiahSchema.min(1).optional(),
    reason: z.string().trim().min(3).max(500),
    idempotencyKey: z.uuid(),
  })
  .superRefine((value, context) => {
    if (value.kind === 'refund' && value.amountRupiah === undefined)
      context.addIssue({
        code: 'custom',
        path: ['amountRupiah'],
        message: 'A refund amount is required.',
      });
    if (value.kind === 'void' && value.amountRupiah !== undefined)
      context.addIssue({
        code: 'custom',
        path: ['amountRupiah'],
        message: 'A void always reverses the full payment.',
      });
  });

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type PaymentCorrectionInput = z.infer<typeof paymentCorrectionSchema>;
