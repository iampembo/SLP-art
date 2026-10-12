// All money math in integer cents. Never use floats for totals.
export function toCents(aud: number): number {
  return Math.round(aud * 100);
}

export function formatAUD(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(cents / 100);
}
