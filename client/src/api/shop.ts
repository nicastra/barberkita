import { z } from 'zod';

import { apiRequest } from './client';

const shopSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phone: z.string(),
  email: z.string().email(),
  address: z.string(),
  timezone: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const shopResponseSchema = z.object({ shop: shopSchema });
export type Shop = z.infer<typeof shopSchema>;

const staffSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['owner', 'staff']),
});
const staffListSchema = z.object({ staff: z.array(staffSchema) });
const staffResponseSchema = z.object({ staff: staffSchema });
export type StaffMember = z.infer<typeof staffSchema>;

export function getShop() {
  return apiRequest('/api/shop', { schema: shopResponseSchema });
}

export function updateShop(
  input: Partial<
    Pick<Shop, 'name' | 'phone' | 'email' | 'address' | 'timezone'>
  >,
) {
  return apiRequest('/api/shop', {
    method: 'PATCH',
    body: input,
    schema: shopResponseSchema,
  });
}

export function listStaff() {
  return apiRequest('/api/auth/staff', { schema: staffListSchema });
}

export function createStaff(input: {
  name: string;
  email: string;
  password: string;
  role: 'staff' | 'owner';
}) {
  return apiRequest('/api/auth/staff', {
    method: 'POST',
    body: input,
    schema: staffResponseSchema,
  });
}

export function updateStaff(
  id: string,
  input: {
    name?: string;
    email?: string;
    password?: string;
    role?: 'staff' | 'owner';
    active?: boolean;
  },
) {
  return apiRequest(`/api/auth/staff/${id}`, {
    method: 'PATCH',
    body: input,
    schema: staffResponseSchema,
  });
}

export function deleteStaff(id: string) {
  return apiRequest(`/api/auth/staff/${id}`, {
    method: 'DELETE',
    acceptedStatuses: [204],
    schema: z.null(),
  });
}
