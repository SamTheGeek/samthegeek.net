import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.string().optional(),
    categories: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    urlId: z.string().optional(),
    likeCount: z.number().optional(),
    commentCount: z.number().optional(),
    excerptHtml: z.string().optional(),
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
      exif: z.object({
        date: z.string().optional(),
        camera: z.string().optional(),
        lens: z.string().optional(),
        focalLength: z.string().optional(),
        aperture: z.string().optional(),
        shutterSpeed: z.string().optional(),
        iso: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        location: z.string().optional(),
      }).optional(),
    })),
  }),
});

export const collections = { blog, galleries };
