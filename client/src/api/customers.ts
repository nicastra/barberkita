import { z } from 'zod';

import { apiRequest } from './client';

export const customerSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  name: z.string(),
  phone: z.string(),
  email: z.string().email().nullable(),
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Customer = z.infer<typeof customerSchema>;

const customerResponseSchema = z.object({
  customer: customerSchema,
  duplicate: z.boolean().optional(),
});

export type CustomerInput = Pick<
  Customer,
  'name' | 'phone' | 'email' | 'notes'
>;

export function listCustomers(search?: string) {
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  const suffix = query.size ? `?${query.toString()}` : '';
  return apiRequest(`/api/customers${suffix}`, {
    schema: z.object({ customers: z.array(customerSchema) }),
  });
}

export function createCustomer(input: CustomerInput) {
  return apiRequest('/api/customers', {
    method: 'POST',
    body: input,
    schema: customerResponseSchema,
  });
}

export function updateCustomer(id: string, input: Partial<CustomerInput>) {
  return apiRequest(`/api/customers/${id}`, {
    method: 'PATCH',
    body: input,
    schema: customerResponseSchema,
  });
}
