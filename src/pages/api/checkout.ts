export const prerender = false;

import Stripe from 'stripe';
import { getCollection } from 'astro:content';
import { displayName, unitAmountCents } from '../../lib/pricing';

interface IncomingItem {
  id: string;
  qty: number;
  variant?: string;
}

function bad(status: number, error: string, detail?: string): Response {
  return new Response(JSON.stringify({ error, detail }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST({
  request,
  locals,
}: {
  request: Request;
  locals: unknown;
}): Promise<Response> {
  // On Cloudflare Workers, secrets live in runtime env (dashboard Secrets),
  // not build-time import.meta.env. Fall back to import.meta.env for `npm run dev`.
  const runtimeEnv = (locals as { runtime?: { env?: Record<string, string> } })
    ?.runtime?.env;
  const env = (k: string): string | undefined =>
    runtimeEnv?.[k] ?? (import.meta.env as Record<string, string | undefined>)[k];
  const secret = env('STRIPE_SECRET_KEY');
  const site = env('PUBLIC_SITE_URL') ?? new URL(request.url).origin;
  if (!secret) {
    // Diagnostic booleans only — never echo values.
    const hasRuntime = Boolean(
      (locals as { runtime?: unknown })?.runtime,
    );
    const hasBuildKey = Boolean(
      (import.meta.env as Record<string, string | undefined>)
        .STRIPE_SECRET_KEY,
    );
    return bad(
      500,
      'NOT_CONFIGURED',
      `runtime:${hasRuntime ? 'yes' : 'no'} buildEnv:${hasBuildKey ? 'yes' : 'no'}`,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad(400, 'INVALID', 'Body must be JSON');
  }
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
    return bad(400, 'EMPTY', 'Cart is empty');
  }

  const products = await getCollection('products');
  const byId = new Map(products.map((p) => [p.data.id, p.data]));

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const meta: string[] = [];

  for (const raw of items as IncomingItem[]) {
    if (
      typeof raw?.id !== 'string' ||
      !Number.isInteger(raw.qty) ||
      raw.qty < 1 ||
      raw.qty > 10
    ) {
      return bad(400, 'INVALID', 'Bad item');
    }
    const product = byId.get(raw.id);
    if (!product) return bad(400, 'INVALID', `Unknown product ${raw.id}`);
    if (product.status !== 'available') {
      return bad(400, 'SOLD_OUT', `${product.title} just sold`);
    }
    let unit_amount: number;
    try {
      unit_amount = unitAmountCents(product, raw.variant);
    } catch {
      return bad(400, 'INVALID_VARIANT', `Bad variant for ${product.title}`);
    }
    line_items.push({
      price_data: {
        currency: 'aud',
        unit_amount,
        product_data: {
          name: displayName(product, raw.variant),
          images: [`${site}${product.image}`],
          metadata: { productId: product.id, variant: raw.variant ?? '' },
        },
      },
      quantity: raw.qty,
    });
    meta.push(`${product.id}${raw.variant ? `|${raw.variant}` : ''}x${raw.qty}`);
  }

  const stripe = new Stripe(secret);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    locale: 'auto',
    line_items,
    success_url: `${site}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/cancel`,
    shipping_address_collection: { allowed_countries: ['AU'] },
    metadata: { items: meta.join(',').slice(0, 450) },
  });

  if (!session.url) return bad(500, 'NOT_CONFIGURED', 'No session URL');
  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
