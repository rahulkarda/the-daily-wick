/**
 * Series helpers — load definitions, group posts.
 *
 * A series is declared in content/series/series.json:
 *   { "series": [
 *       { "slug": "foundations-week-1", "title": "Foundations, week 1",
 *         "description": "Five posts on first principles." }
 *     ] }
 *
 * A post opts in via the `series: { slug, part }` frontmatter field. Posts
 * pointing at an unknown slug are dropped from series listings (we log it
 * during build). Within a series, posts are ordered by `part` ascending,
 * with pubDate as the tiebreak.
 */
import type { CollectionEntry } from 'astro:content';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SeriesDef {
  slug: string;
  title: string;
  description?: string;
}

type Post = CollectionEntry<'posts'>;

export interface SeriesGroup {
  def: SeriesDef;
  posts: Post[];
}

export async function loadSeriesDefs(): Promise<SeriesDef[]> {
  const here = fileURLToPath(import.meta.url);
  const p = resolve(here, '../../../content/series/series.json');
  try {
    const raw = JSON.parse(await readFile(p, 'utf-8')) as { series: SeriesDef[] };
    return Array.isArray(raw.series) ? raw.series : [];
  } catch {
    return [];
  }
}

/** Returns groups in the order series.json declares them; only series that have posts are returned. */
export function groupBySeries(posts: Post[], defs: SeriesDef[]): SeriesGroup[] {
  const bySlug = new Map(defs.map((d) => [d.slug, d]));
  const buckets = new Map<string, Post[]>();
  for (const p of posts) {
    if (!p.data.series) continue;
    if (!bySlug.has(p.data.series.slug)) {
      // GitHub Actions picks up `::warning::` and surfaces it in the run
      // summary — much louder than a plain console.warn that scrolls past.
      const msg = `[series] post ${p.slug} references unknown series "${p.data.series.slug}" — declare it in content/series/series.json`;
      if (process.env.GITHUB_ACTIONS) {
        console.log(`::warning file=src/content/posts/${p.slug}.mdx::${msg}`);
      } else {
        console.warn(msg);
      }
      continue;
    }
    const list = buckets.get(p.data.series.slug) ?? [];
    list.push(p);
    buckets.set(p.data.series.slug, list);
  }
  // Order by `part`, then pubDate.
  for (const list of buckets.values()) {
    list.sort((a, b) => {
      const pa = a.data.series?.part ?? 0;
      const pb = b.data.series?.part ?? 0;
      if (pa !== pb) return pa - pb;
      return a.data.pubDate.valueOf() - b.data.pubDate.valueOf();
    });
  }

  const out: SeriesGroup[] = [];
  for (const def of defs) {
    const list = buckets.get(def.slug);
    if (list && list.length > 0) out.push({ def, posts: list });
  }
  return out;
}

/** Find the def + sorted siblings for a given post, or null if not in a series. */
export function findSeriesContext(
  post: Post,
  posts: Post[],
  defs: SeriesDef[],
): { def: SeriesDef; index: number; siblings: Post[] } | null {
  if (!post.data.series) return null;
  const def = defs.find((d) => d.slug === post.data.series!.slug);
  if (!def) return null;
  const groups = groupBySeries(posts, defs);
  const group = groups.find((g) => g.def.slug === def.slug);
  if (!group) return null;
  const index = group.posts.findIndex((p) => p.slug === post.slug);
  if (index < 0) return null;
  return { def, index, siblings: group.posts };
}
