import { describe, expect, it } from 'vitest';
import { cartCount, cartTotalCents, type CartItem } from './cart';
import { formatAUD, toCents } from './money';

describe('money', () => {
  it('converts AUD dollars to cents without float drift', () => {
    expect(toCents(85)).toBe(8500);
    expect(toCents(19.99)).toBe(1999);
  });
  it('formats cents as AUD', () => {
    expect(formatAUD(8500)).toContain('85');
    expect(formatAUD(8500)).toMatch(/AUD|\$/);
  });
});

describe('cart', () => {
  const prices: Record<string, number> = {
    'test-original-001': 45000,
    'test-print-001|A4 unframed': 8500,
    'test-print-001|A3 framed': 12500,
  };
  const priceOf = (i: CartItem) =>
    prices[i.variant ? `${i.id}|${i.variant}` : i.id] ?? 0;

  it('counts quantities', () => {
    expect(cartCount([{ id: 'a', qty: 2 }, { id: 'b', qty: 1 }])).toBe(3);
  });
  it('totals with variant price deltas', () => {
    const items: CartItem[] = [
      { id: 'test-print-001', qty: 1, variant: 'A4 unframed' },
      { id: 'test-print-001', qty: 1, variant: 'A3 framed' },
    ];
    expect(cartTotalCents(items, priceOf)).toBe(8500 + 12500);
  });
  it('totals an original at full price', () => {
    expect(
      cartTotalCents([{ id: 'test-original-001', qty: 1 }], priceOf),
    ).toBe(45000);
  });
});
