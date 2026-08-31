import { z } from 'zod';

const dateSchema = z.iso.date();

export const dashboardQuerySchema = z.object({
  date: dateSchema.optional(),
});

export const reportRangeQuerySchema = z
  .object({
    from: dateSchema.optional(),
    to: dateSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'The end date must be on or after the start date.',
      });
    }
  });

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
export type ReportRangeQuery = z.infer<typeof reportRangeQuerySchema>;
