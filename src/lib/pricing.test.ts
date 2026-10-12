import { describe, expect, it } from 'vitest';
import { displayName, unitAmountCents, type PricedProduct } from './pricing';

const original: PricedProduct = {
  id: 'test-original-001',
  title: 'Harbour Light (Original)',
  type: 'original',
  priceAUD: 450,
  status: 'available',
  image: '/images/test-original-001.svg',
};

const print: PricedProduct = {
  id: 'test-print-001',
  title: 'Harbour Light (Print)',
  type: 'print',
  priceAUD: 85,
  status: 'available',
  image: '/images/test-print-001.svg',
  variants: [
    { name: 'A4 unframed', priceDelta: 0 },
    { name: 'A3 framed', priceDelta: 40 },
  ],
};

describe('pricing', () => {
  it('prices an original at face value', () => {
    expect(unitAmountCents(original)).toBe(45000);
  });
  it('applies print variant deltas', () => {
    expect(unitAmountCents(print, 'A4 unframed')).toBe(8500);
    expect(unitAmountCents(print, 'A3 framed')).toBe(12500);
  });
  it('rejects missing/unknown variants for prints', () => {
    expect(() => unitAmountCents(print)).toThrow('INVALID_VARIANT');
    expect(() => unitAmountCents(print, 'A0 mural')).toThrow('INVALID_VARIANT');
  });
  it('builds display names', () => {
    expect(displayName(original)).toBe('Harbour Light (Original)');
    expect(displayName(print, 'A3 framed')).toBe(
      'Harbour Light (Print) — A3 framed',
    );
  });
});
