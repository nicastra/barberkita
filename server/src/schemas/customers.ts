import { z } from 'zod';

export const customerInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z
    .string()
    .trim()
    .min(6)
    .max(40)
    .regex(/^\+?[\d\s().-]+$/, 'Use a valid phone number'),
  email: z.string().trim().email().max(320).nullable().default(null),
  notes: z.string().trim().max(2_000).default(''),
});

export const updateCustomerSchema = customerInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one customer field is required',
  });

export const customerQuerySchema = z.object({
  search: z.string().trim().max(160).optional(),
});

export const customerIdSchema = z.object({ id: z.string().uuid() });
