export const prerender = false;

import Stripe from 'stripe';
import { getCollection } from 'astro:content';
import { env as cfEnv } from 'cloudflare:workers';
import { buildOrderEmail, parseCart, type OrderItem } from '../../lib/orders';
import { unitAmountCents } from '../../lib/pricing';
import { notifySale } from '../../lib/notify';

function json(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST({
  request,
}: {
  request: Request;
}): Promise<Response> {
  const cf = cfEnv as Record<string, string | undefined>;
  const build = import.meta.env as Record<string, string | undefined>;
  const secret = cf.STRIPE_SECRET_KEY ?? build.STRIPE_SECRET_KEY;
  const whSecret =
    cf.STRIPE_WEBHOOK_SECRET ?? build.STRIPE_WEBHOOK_SECRET;
  if (!secret || !whSecret) {
    console.error('webhook NOT_CONFIGURED');
    return json(500, { error: 'NOT_CONFIGURED' });
  }

  const sig = request.headers.get('stripe-signature');
  if (!sig) return json(400, { error: 'INVALID_SIGNATURE' });
  const raw = await request.text();

  const stripe = new Stripe(secret);
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, whSecret);
  } catch {
    return json(400, { error: 'INVALID_SIGNATURE' });
  }

  if (event.type !== 'checkout.session.completed') {
    return json(200, { received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const products = await getCollection('products');
  const byId = new Map(products.map((p) => [p.data.id, p.data]));

  const items: OrderItem[] = [];
  for (const line of parseCart(session.metadata?.cart)) {
    const p = byId.get(line.id);
    if (!p) continue;
    items.push({
      productId: p.id,
      title: p.title,
      type: p.type,
      variant: line.variant ?? '',
      qty: line.qty,
      unitCents: unitAmountCents(p, line.variant),
    });
  }

  const summary = {
    sessionId: session.id,
    totalCents: session.amount_total ?? 0,
    currency: session.currency ?? 'aud',
    customerEmail: session.customer_details?.email ?? 'unknown',
    customerName: session.customer_details?.name ?? 'unknown',
    items,
  };
  console.log('order', JSON.stringify(summary));

  const { subject, text } = buildOrderEmail(summary);
  const result = await notifySale(
    {
      RESEND_API_KEY: cf.RESEND_API_KEY ?? build.RESEND_API_KEY,
      NOTIFY_EMAIL: cf.NOTIFY_EMAIL ?? build.NOTIFY_EMAIL,
      NOTIFY_FROM: cf.NOTIFY_FROM ?? build.NOTIFY_FROM,
    },
    subject,
    text,
  );
  console.log('notify', JSON.stringify(result));

  return json(200, { received: true, emailed: result.sent });
}
