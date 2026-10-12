import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const products = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/products' }),
  schema: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    type: z.enum(['original', 'print']),
    priceAUD: z.number().positive(),
    status: z.enum(['available', 'sold']),
    image: z.string().min(1),
    url: z.string().startsWith('/art/'),
    stock: z.number().int().min(0).optional(),
    variants: z
      .array(z.object({ name: z.string().min(1), priceDelta: z.number() }))
      .optional(),
  }),
});

export const collections = { products };
