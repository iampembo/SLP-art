import { formatAUD } from './money';

export interface OrderItem {
  productId: string;
  title: string;
  type: 'original' | 'print';
  variant: string;
  qty: number;
  unitCents: number;
}

export interface OrderSummary {
  sessionId: string;
  totalCents: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  items: OrderItem[];
}

/** Parse the `cart` metadata written by /api/checkout (JSON array). Never throws. */
export function parseCart(
  raw: string | undefined,
): { id: string; qty: number; variant?: string }[] {
  try {
    const parsed = JSON.parse(raw ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l) =>
        typeof l?.id === 'string' &&
        Number.isInteger(l.qty) &&
        l.qty > 0 &&
        (l.variant === undefined || typeof l.variant === 'string'),
    );
  } catch {
    return [];
  }
}

/** Email for mum: what sold, totals, and which originals to mark SOLD. */
export function buildOrderEmail(s: OrderSummary): {
  subject: string;
  text: string;
} {
  const lines = s.items.map(
    (i) =>
      `- ${i.title}${i.variant ? ` — ${i.variant}` : ''} × ${i.qty} = ${formatAUD(i.unitCents * i.qty)}`,
  );
  const originals = s.items.filter((i) => i.type === 'original');
  const action =
    originals.length > 0
      ? `\nACTION NEEDED — mark these as SOLD in /admin so nobody else can buy them:\n${originals.map((i) => `  * ${i.productId}`).join('\n')}\n`
      : `\nNo originals in this order — nothing to mark sold (prints are made to order).\n`;
  return {
    subject: `New SLP-art sale ${formatAUD(s.totalCents)} — ${s.sessionId.slice(-8)}`,
    text: [
      `New order ${s.sessionId}`,
      `Total: ${formatAUD(s.totalCents)} ${s.currency.toUpperCase()}`,
      `Customer: ${s.customerName} <${s.customerEmail}>`,
      ``,
      `Items:`,
      ...lines,
      action,
    ].join('\n'),
  };
}
