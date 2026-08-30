import { z } from 'zod';

export const shopSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(1).max(40),
  email: z.string().trim().email().max(320),
  address: z.string().trim().min(1).max(500),
  timezone: z.string().trim().min(1).max(80),
});

export const updateShopSchema = shopSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one shop field is required',
  );
