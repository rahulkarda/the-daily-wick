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
      // Two parallel feeds — micros are the daily quick-hit, essays are
      // the longer "sit with it" pieces that go deeper. Default = micro
      // so legacy posts (and humans hand-authoring) don't have to think.
      format: z.enum(['micro', 'essay']).default('micro'),
      heroImage: image(),
      heroAlt: z.string(),
      heroCredit: z.object({
        photographer: z.string(),
        photographerUrl: z.string().url(),
        // Source URL for the photo on whichever provider was used.
        // Named `unsplashUrl` for legacy compatibility; can also point at
        // a Pexels page when Pexels was the source.
        unsplashUrl: z.string().url(),
        source: z.enum(['unsplash', 'pexels', 'fallback']).default('unsplash'),
      }),
      epigraph: z
        .object({
          text: z.string(),
          attribution: z.string(),
        })
        .optional(),
      // Inline citations the body relies on — papers, primary sources, etc.
      // Kept terse: label + url.
      sources: z
        .array(
          z.object({
            label: z.string(),
            url: z.string().url(),
          }),
        )
        .max(6)
        .optional(),
      // Curated "if this hooked you, go here next" — books, essays, videos,
      // podcasts. Richer shape than `sources` so we can render with kind +
      // a one-line rationale.
      furtherReading: z
        .array(
          z.object({
            label: z.string().min(3).max(160),
            url: z.string().url(),
            kind: z
              .enum(['book', 'essay', 'paper', 'podcast', 'video', 'site'])
              .default('essay'),
            note: z.string().max(160).optional(),
          }),
        )
        .max(8)
        .optional(),
      aiDrafted: z.boolean().default(true),
      curator: z.string().default('Rahul Karda'),
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
