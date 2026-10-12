# SLP-art — Mum's Art Shop Plan (AUD / AU)

Stack: Astro (static) + Stripe Checkout only + Cloudflare Pages + Decap CMS
Constraints: $0/mo platform fees, only Stripe AU processing. Prints made-to-order. <50 SKUs.
Do NOT use Snipcart ($20/mo floor) or Lemon Squeezy (digital-only, 5%+50c, no AU physical shipping).

## 0. AU facts baked in
- Stripe AU: 1.7% + A$0.30 domestic cards (drops to 1.65% + A$0.30 from 1 Oct 2026), 3.5% + A$0.30 intl. Fees include GST. No monthly fee.
- From 1 Oct 2026 AU card surcharges banned (RBA) — DO NOT add a checkout surcharge. Bake fees into AUD prices.
- Currency: `AUD`, locale `en-AU`. Afterpay/Zip (5.49%+30c) is OFF for MVP.
- Shipping MVP: AU only. Prints flat A$9, Originals flat A$15 tracked + signature, free over A$200. Configure in Stripe Dashboard > Shipping rates. No live AusPost calc for MVP.
- Node >=22.12 required (engines field). No global Astro CLI needed — use `npx astro` / `npm run` scripts. Tailwind via `@tailwindcss/vite` (already added).

## 1. How it works (for AI + PO)
Static Astro pages -> tiny JS cart (localStorage + nanostores) -> POST /api/checkout validates price/status
from content files server-side -> Stripe hosted Checkout -> webhook POST /api/webhook marks original sold.
Prints: infinite stock (made to order). Originals: `status: available|sold`, `stock: 1`.

```
Mum edits via /admin (Decap, Phase 4) -> markdown in src/content/products/
  -> Astro static build -> Cloudflare Pages (dist/)
  -> browser cart -> Stripe Checkout (AUD) -> webhook -> sold flag + email
```

## 2. Product schema (single source of truth)
File: `src/content/products/<slug>.md` (to be added in Phase 1):
```yaml
id: sunset-harbour-original # unique SKU, never change
title: Sunset Harbour
type: original # or: print
priceAUD: 450.00
status: available # or: sold
image: /images/sunset-harbour.jpg
url: /art/sunset-harbour # must be real page URL
variants: # prints only
  - { name: "A4 unframed", priceDelta: 0 }
  - { name: "A3 framed", priceDelta: 40 }
```

## 3. TDD-style execution — AI must self-check each phase before advancing

### Phase 0 — Scaffold [x] (this commit)
- [x] Astro minimal + TypeScript strict + Tailwind, `output: 'static'`
- [x] BaseLayout, /, /shop, /about, /success, /cancel placeholders
- [x] `wrangler.jsonc` (assets `./dist`), `.env.example`
Self-check (must all pass):
```
npm run build
npx astro check
ls dist/index.html dist/shop/index.html
```
Done when: build green, static output only.

### Phase 1 — Catalogue + cart UI [ ]
Tasks:
- [ ] Content collection `products` with Zod schema matching §2 + 2 fixtures:
  `test-original-001` (450.00, stock 1), `test-print-001` (85.00 + variants)
- [ ] `src/lib/cart.ts` (nanostores): add/remove/clear, totals in **cents**, persist localStorage
- [ ] `src/lib/money.ts`: `toCents(aud)`, `formatAUD(cents)` with `Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'})`
- [ ] Product card + `/art/[slug]` page; sold original button disabled
- [ ] Test: `src/lib/cart.test.ts` (vitest): totals, persist, variant delta
Self-check:
```
npm run build
npx vitest run --reporter=verbose
# manual: add original, reload, cart persists; sold item cannot be added
```
Done when: tampered client price cannot change server total (tested in Phase 2).

### Phase 2 — Stripe Checkout, Test mode [ ]
Env: `STRIPE_SECRET_KEY=test_...`, `PUBLIC_SITE_URL=http://localhost:4321`
Tasks:
- [ ] `npm i stripe` (server SDK). Never expose secret to client.
- [ ] `src/pages/api/checkout.ts`: accept `{items:[{id,qty,variant?}]}`, load truth from content,
  reject unknown id / sold original / qty<=0 with 400 `{error:SOLD_OUT|INVALID}`, create Checkout Session:
  `mode:'payment'`, `currency:'aud'`, `metadata:{productId}`, `shipping_options` (AU rates),
  `success_url: PUBLIC_SITE_URL + '/success?session_id={CHECKOUT_SESSION_ID}'`, `cancel_url: .../cancel`
- [ ] Wire cart Checkout button to POST + redirect to `session.url`
Self-check:
```
stripe listen --forward-to localhost:4321/api/webhook  # needs Stripe CLI (brew install stripe/stripe-cli/stripe)
npm run dev
# valid print -> 303 with stripe URL; tampered price -> 400; sold original -> 400 SOLD_OUT
```
Done when: server is source of truth, client total ignored.

### Phase 3 — Webhook + sold flip [ ]
Tasks:
- [ ] `src/pages/api/webhook.ts`: verify `stripe-signature` with `STRIPE_WEBHOOK_SECRET`,
  handle `checkout.session.completed`: log order, email mum (Resend for MVP), flag original sold
  (MVP: manual flip of fixture file + redeploy is acceptable; automate commit later)
Self-check:
```
stripe trigger checkout.session.completed
# expect 200, order logged, second buy of same test original -> 400
```
Done when: double-buy of 1-of-1 blocked end-to-end in Test mode.

### Phase 4 — Mum CMS (Decap) [ ]
Tasks:
- [ ] `public/admin/index.html` + `config.yml`: collection `products`, fields = §2 schema, media `public/images`
- [ ] GitHub auth (or Netlify Identity); editorial workflow OFF for MVP
Self-check:
```
npm run build
# PO manual: non-technical user adds a print via /admin, publishes, Cloudflare rebuilds <2min, appears in /shop
```
Done when: mum completes this without VS Code.

### Phase 5 — Cloudflare Pages + AU launch [ ]
Tasks:
- [ ] Connect GitHub repo -> Pages (build `npm run build`, dir `dist`), set env
  `STRIPE_SECRET_KEY=live_...`, `STRIPE_WEBHOOK_SECRET=live_...`, `PUBLIC_SITE_URL=https://yourdomain.com.au`
- [ ] Stripe Live: products, AU shipping rates, ABN + bank payout, GST settings, webhook endpoint `https://yourdomain.com.au/api/webhook`
- [ ] Custom domain, privacy/shipping-returns pages, alt text, OG images
Self-check:
```
npm run build && npx wrangler pages deploy dist
curl -I https://yourdomain.com.au/art/test-print-001 # 200
# live A$1 order with real card -> refund in Dashboard -> status sold
```
Done when: live A$1 test + refund clean, no surcharge added at checkout.

## 4. Risks / PO notes
- Race on 1-of-1 originals (two buyers <60s): accept + instant-refund policy for MVP.
- No inventory dashboard: stock = `status` dropdown in /admin + Stripe orders list. Fine for 1 person.
- Never commit `.env`. Never trust client price. All money math in cents.
- Deps to install per phase: `stripe`, `nanostores` (Phase 1-2), `vitest` (Phase 1), `resend` (Phase 3, optional).
  Stripe CLI + Wrangler via Homebrew/npx when needed — not npm deps.
