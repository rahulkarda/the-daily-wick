import type { CollectionEntry } from 'astro:content';
import { computeStreak as computeStreakJs } from './streak.mjs';

type Post = CollectionEntry<'posts'>;

export interface SiteStats {
  totalPosts: number;
  totalWords: number;
  totalMinutes: number;
  microCount: number;
  essayCount: number;
  firstPubDate: Date;
  lastPubDate: Date;
  daysSinceFirst: number;
  topTags: { tag: string; count: number }[];
  themeDistribution: { theme: string; count: number }[];
  longestStreak: { length: number; start: Date; end: Date } | null;
  averageWordsPerPost: number;
  totalSources: number;
  totalFurtherReading: number;
  longestPost: { title: string; slug: string; words: number } | null;
  shortestPost: { title: string; slug: string; words: number } | null;
}

function wordCount(body: string): number {
  return body.trim().split(/\s+/).filter(Boolean).length;
}

export function computeStats(posts: Post[]): SiteStats {
  const byDate = [...posts].sort(
    (a, b) => a.data.pubDate.valueOf() - b.data.pubDate.valueOf(),
  );

  const wordCounts = posts.map((p) => ({
    slug: p.slug,
    title: p.data.title,
    words: wordCount(p.body),
  }));
  const totalWords = wordCounts.reduce((s, x) => s + x.words, 0);

  // Average reading speed ~225 wpm; round up.
  const totalMinutes = Math.ceil(totalWords / 225);

  const microCount = posts.filter((p) => (p.data.format ?? 'micro') === 'micro').length;
  const essayCount = posts.filter((p) => p.data.format === 'essay').length;

  const tagCounts = new Map<string, number>();
  for (const p of posts) {
    for (const t of p.data.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const topTags = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  const themeCounts = new Map<string, number>();
  for (const p of posts) {
    themeCounts.set(p.data.monthlyTheme, (themeCounts.get(p.data.monthlyTheme) ?? 0) + 1);
  }
  const themeDistribution = [...themeCounts.entries()]
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count);

  const totalSources = posts.reduce((s, p) => s + (p.data.sources?.length ?? 0), 0);
  const totalFurtherReading = posts.reduce(
    (s, p) => s + (p.data.furtherReading?.length ?? 0),
    0,
  );

  const sortedByLen = [...wordCounts].sort((a, b) => b.words - a.words);
  const longestPost = sortedByLen[0] ?? null;
  const shortestPost = sortedByLen[sortedByLen.length - 1] ?? null;

  const firstPubDate = byDate[0]?.data.pubDate ?? new Date();
  const lastPubDate = byDate[byDate.length - 1]?.data.pubDate ?? new Date();
  const daysSinceFirst = Math.max(
    1,
    Math.round((Date.now() - firstPubDate.valueOf()) / 86_400_000),
  );

  return {
    totalPosts: posts.length,
    totalWords,
    totalMinutes,
    microCount,
    essayCount,
    firstPubDate,
    lastPubDate,
    daysSinceFirst,
    topTags,
    themeDistribution,
    longestStreak: computeStreakJs(posts) as SiteStats['longestStreak'],
    averageWordsPerPost: posts.length === 0 ? 0 : Math.round(totalWords / posts.length),
    totalSources,
    totalFurtherReading,
    longestPost,
    shortestPost,
  };
}
