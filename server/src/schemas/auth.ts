import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(200),
});

export const setupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  password: z.string().min(12).max(200),
  shop: z.object({
    name: z.string().trim().min(1).max(160),
    phone: z.string().trim().min(1).max(40),
    email: z.string().trim().email().max(320),
    address: z.string().trim().min(1).max(500),
    timezone: z.string().trim().min(1).max(80).default('Asia/Jakarta'),
  }),
});

export const createStaffSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  password: z.string().min(12).max(200),
  role: z.enum(['owner', 'staff']).default('staff'),
});

export const updateStaffSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(320).optional(),
  password: z.string().min(12).max(200).optional(),
  role: z.enum(['owner', 'staff']).optional(),
  active: z.boolean().optional(),
});

export const staffIdSchema = z.object({ id: z.string().uuid() });
