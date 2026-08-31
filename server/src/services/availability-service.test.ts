import { describe, expect, it } from 'vitest';

import {
  overlapsReservation,
  subtractRanges,
  zonedMinuteToDate,
} from './availability-service';

describe('availability time calculations', () => {
  it('interprets local schedule minutes in the shop timezone', () => {
    expect(
      zonedMinuteToDate('2026-09-01', 9 * 60, 'Asia/Jakarta')?.toISOString(),
    ).toBe('2026-09-01T02:00:00.000Z');
  });

  it('removes breaks and time off from working ranges', () => {
    expect(
      subtractRanges(
        [{ start: 9 * 60, end: 17 * 60 }],
        [
          { start: 12 * 60, end: 13 * 60 },
          { start: 15 * 60, end: 16 * 60 },
        ],
      ),
    ).toEqual([
      { start: 9 * 60, end: 12 * 60 },
      { start: 13 * 60, end: 15 * 60 },
      { start: 16 * 60, end: 17 * 60 },
    ]);
  });

  it('does not invent a timestamp during a daylight-saving gap', () => {
    expect(
      zonedMinuteToDate('2026-03-08', 2 * 60 + 30, 'America/New_York'),
    ).toBeNull();
  });

  it('rejects overlapping reservations but allows adjacent slots', () => {
    const reservations = [
      {
        barberId: 'barber-1',
        startAt: new Date('2026-09-01T02:30:00.000Z'),
        endAt: new Date('2026-09-01T03:00:00.000Z'),
      },
    ];
    expect(
      overlapsReservation(
        'barber-1',
        new Date('2026-09-01T02:45:00.000Z'),
        new Date('2026-09-01T03:15:00.000Z'),
        reservations,
      ),
    ).toBe(true);
    expect(
      overlapsReservation(
        'barber-1',
        new Date('2026-09-01T03:00:00.000Z'),
        new Date('2026-09-01T03:30:00.000Z'),
        reservations,
      ),
    ).toBe(false);
  });
});
