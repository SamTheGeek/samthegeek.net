import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.string().optional(),
  }),
});

const galleries = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    location: z.string(),
    publishedDate: z.coerce.date(),
    description: z.string().optional(),
    images: z.array(z.object({
      src: z.string(),
      alt: z.string(),
    })),
  }),
});

export const collections = { blog, galleries };
