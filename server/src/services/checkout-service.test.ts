import { describe, expect, it } from 'vitest';

import {
  calculateCheckoutTotals,
  CheckoutDomainError,
} from './checkout-service';

describe('checkout totals', () => {
  it('calculates integer-rupiah totals without floating point arithmetic', () => {
    expect(calculateCheckoutTotals(125_000, 25_000)).toEqual({
      subtotalRupiah: 125_000,
      discountRupiah: 25_000,
      totalRupiah: 100_000,
    });
  });

  it('rejects an adjustment larger than the subtotal', () => {
    expect(() => calculateCheckoutTotals(50_000, 50_001)).toThrowError(
      CheckoutDomainError,
    );
  });
});
