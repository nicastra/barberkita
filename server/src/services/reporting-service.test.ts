import { describe, expect, it } from 'vitest';

import {
  reportDateRange,
  ReportingDomainError,
  summarizeRevenue,
} from './reporting-service';

describe('reporting date ranges', () => {
  it('converts an inclusive Jakarta calendar day to UTC boundaries', () => {
    const range = reportDateRange(
      'Asia/Jakarta',
      '2026-08-31',
      '2026-08-31',
      new Date('2026-08-31T12:00:00.000Z'),
    );
    expect(range.start.toISOString()).toBe('2026-08-30T17:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-08-31T17:00:00.000Z');
  });

  it('uses the shop-local current day for an omitted empty range', () => {
    const range = reportDateRange(
      'Asia/Jakarta',
      undefined,
      undefined,
      new Date('2026-08-30T18:00:00.000Z'),
    );
    expect(range.from).toBe('2026-08-31');
    expect(range.to).toBe('2026-08-31');
  });

  it('rejects an inverted range', () => {
    expect(() =>
      reportDateRange('Asia/Jakarta', '2026-09-02', '2026-09-01', new Date()),
    ).toThrowError(ReportingDomainError);
  });
});

describe('reporting revenue', () => {
  it('subtracts each correction exactly once from recorded payments', () => {
    expect(summarizeRevenue([100_000, 50_000], [20_000, 50_000])).toEqual({
      grossRupiah: 150_000,
      correctionsRupiah: 70_000,
      netRupiah: 80_000,
    });
  });

  it('returns an explicit zero result for an empty range', () => {
    expect(summarizeRevenue([], [])).toEqual({
      grossRupiah: 0,
      correctionsRupiah: 0,
      netRupiah: 0,
    });
  });
});
