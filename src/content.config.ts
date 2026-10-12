import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Decap sometimes writes numbers as strings (or "" for cleared optional
// fields). Coerce so one field can never break the whole site build.
const audPrice = z.coerce.number().positive();
const optionalStock = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.coerce.number().int().min(0).optional(),
);

const products = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/products' }),
  schema: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    type: z.enum(['original', 'print']),
    priceAUD: audPrice,
    status: z.enum(['available', 'sold']),
    image: z.string().min(1),
    url: z.string().startsWith('/art/'),
    stock: optionalStock,
    variants: z
      .array(z.object({ name: z.string().min(1), priceDelta: z.coerce.number() }))
      .optional(),
  }),
});

export const collections = { products };
