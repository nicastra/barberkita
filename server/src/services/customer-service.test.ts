import { describe, expect, it } from 'vitest';

import { normalizePhone } from './customer-service';

describe('customer contact normalization', () => {
  it('normalizes formatted local and international phone numbers', () => {
    expect(normalizePhone('0812 345-6789')).toBe('08123456789');
    expect(normalizePhone('+62 (812) 345-6789')).toBe('+628123456789');
  });
});
