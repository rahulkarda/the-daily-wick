import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      title: z.string().min(8).max(120),
      subtitle: z.string().max(180).optional(),
      pubDate: z.coerce.date(),
      tags: z.array(z.string().toLowerCase()).min(1).max(5),
      monthlyTheme: z.string(),
      heroImage: image(),
      heroAlt: z.string(),
      heroCredit: z.object({
        photographer: z.string(),
        photographerUrl: z.string().url(),
        unsplashUrl: z.string().url(),
      }),
      epigraph: z
        .object({
          text: z.string(),
          attribution: z.string(),
        })
        .optional(),
      sources: z
        .array(
          z.object({
            label: z.string(),
            url: z.string().url(),
          }),
        )
        .max(6)
        .optional(),
      aiDrafted: z.boolean().default(true),
      curator: z.string().default('the Editor'),
      draft: z.boolean().default(false),
    }),
});

const newsletterIssues = defineCollection({
  type: 'data',
  schema: z.object({
    issueNumber: z.number().int().positive(),
    sentAt: z.coerce.date(),
    postSlug: z.string(),
    buttondownId: z.string().optional(),
  }),
});

export const collections = { posts, newsletterIssues };
