import { atom } from 'nanostores';

export interface CartItem {
  id: string;
  qty: number;
  variant?: string;
}

const KEY = 'slp-art-cart-v1';

function load(): CartItem[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((i) => typeof i?.id === 'string' && i.qty > 0);
  } catch {
    return [];
  }
}

function save(items: readonly CartItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // private mode etc — cart just won't persist
  }
}

export const $cart = atom<CartItem[]>(load());
$cart.subscribe((items) => save(items));

export function addToCart(id: string, qty = 1, variant?: string): void {
  const items = [...$cart.get()];
  const found = items.find((i) => i.id === id && i.variant === variant);
  if (found) found.qty += qty;
  else items.push({ id, qty, variant });
  $cart.set(items);
}

export function removeFromCart(id: string, variant?: string): void {
  $cart.set($cart.get().filter((i) => !(i.id === id && i.variant === variant)));
}

export function clearCart(): void {
  $cart.set([]);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.qty, 0);
}

/** priceOf returns unit price in cents for an item (handles variant deltas). */
export function cartTotalCents(
  items: CartItem[],
  priceOf: (item: CartItem) => number,
): number {
  return items.reduce((sum, i) => sum + priceOf(i) * i.qty, 0);
}
