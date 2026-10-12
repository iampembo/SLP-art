import { describe, expect, it } from 'vitest';
import { buildOrderEmail, parseCart } from './orders';

describe('parseCart', () => {
  it('parses valid metadata', () => {
    expect(
      parseCart(
        JSON.stringify([{ id: 'a', qty: 2, variant: 'A3 framed' }]),
      ),
    ).toEqual([{ id: 'a', qty: 2, variant: 'A3 framed' }]);
  });
  it('never throws on garbage', () => {
    expect(parseCart(undefined)).toEqual([]);
    expect(parseCart('nope')).toEqual([]);
    expect(parseCart(JSON.stringify([{ id: 'a', qty: 0 }]))).toEqual([]);
  });
});

describe('buildOrderEmail', () => {
  const summary = {
    sessionId: 'cs_test_12345678',
    totalCents: 45000 + 8500,
    currency: 'aud',
    customerEmail: 'buyer@example.com',
    customerName: 'Test Buyer',
    items: [
      {
        productId: 'test-original-001',
        title: 'Harbour Light (Original)',
        type: 'original' as const,
        variant: '',
        qty: 1,
        unitCents: 45000,
      },
      {
        productId: 'test-print-001',
        title: 'Harbour Light (Print)',
        type: 'print' as const,
        variant: 'A4 unframed',
        qty: 1,
        unitCents: 8500,
      },
    ],
  };
  it('lists totals and flags originals to mark sold', () => {
    const { subject, text } = buildOrderEmail(summary);
    expect(subject).toContain('12345678');
    expect(text).toContain('test-original-001');
    expect(text).toContain('ACTION NEEDED');
    expect(text).toContain('buyer@example.com');
  });
  it('says nothing to mark when only prints', () => {
    const { text } = buildOrderEmail({ ...summary, items: [summary.items[1]] });
    expect(text).toContain('nothing to mark sold');
    expect(text).not.toContain('ACTION NEEDED');
  });
});
