import type { CollectionEntry } from 'astro:content';

type Post = CollectionEntry<'posts'>;

/**
 * Score by Jaccard tag-overlap; tiebreak by recency (newer first).
 * Returns the top N posts excluding the current one. Drafts excluded.
 */
export function relatedPosts(
  current: Post,
  all: Post[],
  limit = 3,
): Post[] {
  const currentTags = new Set(current.data.tags);

  const scored = all
    .filter((p) => p.id !== current.id && !p.data.draft)
    .map((p) => {
      const otherTags = new Set(p.data.tags);
      const intersection = new Set(
        [...currentTags].filter((t) => otherTags.has(t)),
      ).size;
      const union = new Set([...currentTags, ...otherTags]).size;
      const score = union === 0 ? 0 : intersection / union;
      return { post: p, score };
    });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.post.data.pubDate.valueOf() - a.post.data.pubDate.valueOf();
  });

  return scored.slice(0, limit).map((s) => s.post);
}
