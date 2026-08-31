import { z } from 'zod';

import { apiRequest } from './client';

const performanceRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  bookingCount: z.number().int().nonnegative(),
  completionCount: z.number().int().nonnegative(),
  attributedRevenueRupiah: z.number().int(),
});

const dashboardSchema = z.object({
  date: z.string(),
  timezone: z.string(),
  totals: z.object({
    appointments: z.number().int().nonnegative(),
    upcoming: z.number().int().nonnegative(),
    queue: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
    noShow: z.number().int().nonnegative(),
    initial: z.number().int().nonnegative(),
    confirmed: z.number().int().nonnegative(),
    rescheduled: z.number().int().nonnegative(),
    checkedIn: z.number().int().nonnegative(),
    inService: z.number().int().nonnegative(),
  }),
  appointments: z.array(
    z.object({
      id: z.string(),
      startAt: z.string(),
      endAt: z.string(),
      status: z.string(),
      confirmationCode: z.string(),
      customer: z.object({
        id: z.string(),
        name: z.string(),
        phone: z.string(),
      }),
      barber: z.object({ id: z.string(), name: z.string() }),
      service: z.object({ id: z.string(), name: z.string() }),
    }),
  ),
});

const revenueReportSchema = z.object({
  from: z.string(),
  to: z.string(),
  timezone: z.string(),
  grossRupiah: z.number().int(),
  correctionsRupiah: z.number().int(),
  netRupiah: z.number().int(),
  paymentCount: z.number().int().nonnegative(),
  transactionCount: z.number().int().nonnegative(),
});

const performanceReportSchema = z.object({
  from: z.string(),
  to: z.string(),
  timezone: z.string(),
  staff: z.array(performanceRowSchema),
  services: z.array(performanceRowSchema),
});

export type Dashboard = z.infer<typeof dashboardSchema>;
export type RevenueReport = z.infer<typeof revenueReportSchema>;
export type PerformanceReport = z.infer<typeof performanceReportSchema>;

function query(values: Record<string, string>): string {
  const params = new URLSearchParams(values);
  return params.toString();
}

export async function getDashboard(
  date: string,
  signal?: AbortSignal,
): Promise<Dashboard> {
  const response = await apiRequest(
    `/api/reports/dashboard?${query({ date })}`,
    {
      schema: z.object({ dashboard: dashboardSchema }),
      signal,
    },
  );
  return response.dashboard;
}

export async function getRevenueReport(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<RevenueReport> {
  const response = await apiRequest(
    `/api/reports/revenue?${query({ from, to })}`,
    {
      schema: z.object({ report: revenueReportSchema }),
      signal,
    },
  );
  return response.report;
}

export async function getPerformanceReport(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<PerformanceReport> {
  const response = await apiRequest(
    `/api/reports/performance?${query({ from, to })}`,
    {
      schema: z.object({ report: performanceReportSchema }),
      signal,
    },
  );
  return response.report;
}
