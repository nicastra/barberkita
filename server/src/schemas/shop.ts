import { z } from 'zod';

export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, 'Use a valid IANA timezone');

export const shopSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(1).max(40),
  email: z.string().trim().email().max(320),
  address: z.string().trim().min(1).max(500),
  timezone: timezoneSchema,
});

export const updateShopSchema = shopSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one shop field is required',
  );
