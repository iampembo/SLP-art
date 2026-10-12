import { toCents } from './money';

export interface PricedVariant {
  name: string;
  priceDelta: number;
}

export interface PricedProduct {
  id: string;
  title: string;
  type: 'original' | 'print';
  priceAUD: number;
  status: 'available' | 'sold';
  image: string;
  variants?: PricedVariant[];
}

/** Unit price in cents for a product + optional variant. Throws on unknown variant. */
export function unitAmountCents(
  product: PricedProduct,
  variantName?: string,
): number {
  if (product.variants?.length) {
    if (!variantName) throw new Error('INVALID_VARIANT');
    const v = product.variants.find((x) => x.name === variantName);
    if (!v) throw new Error('INVALID_VARIANT');
    return toCents(product.priceAUD + v.priceDelta);
  }
  return toCents(product.priceAUD);
}

export function displayName(
  product: PricedProduct,
  variantName?: string,
): string {
  return variantName ? `${product.title} — ${variantName}` : product.title;
}
