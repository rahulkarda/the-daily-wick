import type { CollectionEntry } from 'astro:content';

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

/**
 * Compute the longest run of consecutive *publishing days* — Mon-Fri.
 * Saturdays/Sundays don't break the streak; gaps of more than one weekend do.
 *
 * Returns null if fewer than 1 post.
 */
function computeStreak(posts: Post[]): SiteStats['longestStreak'] {
  if (posts.length === 0) return null;

  const sorted = [...posts].sort(
    (a, b) => a.data.pubDate.valueOf() - b.data.pubDate.valueOf(),
  );

  let bestLen = 1;
  let bestStart = sorted[0].data.pubDate;
  let bestEnd = sorted[0].data.pubDate;

  let curLen = 1;
  let curStart = sorted[0].data.pubDate;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].data.pubDate;
    const cur = sorted[i].data.pubDate;
    if (isNextPublishDay(prev, cur)) {
      curLen++;
    } else {
      curLen = 1;
      curStart = cur;
    }
    if (curLen > bestLen) {
      bestLen = curLen;
      bestStart = curStart;
      bestEnd = cur;
    }
  }

  return { length: bestLen, start: bestStart, end: bestEnd };
}

/**
 * True if `b` falls on the next *expected* publish day after `a`:
 * Mon→Tue, Tue→Wed, Wed→Thu, Thu→Fri, Fri→Mon, Sat/Sun ignored.
 */
function isNextPublishDay(a: Date, b: Date): boolean {
  const dayA = a.getUTCDay();
  // Days between in calendar terms
  const msPerDay = 86_400_000;
  const diff = Math.round(
    (Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) -
      Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())) /
      msPerDay,
  );
  if (diff <= 0) return false;
  if (dayA === 5 /* Fri */) return diff === 3; // next Mon
  if (dayA === 6 /* Sat */) return diff === 2; // next Mon
  if (dayA === 0 /* Sun */) return diff === 1;
  return diff === 1;
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
    longestStreak: computeStreak(posts),
    averageWordsPerPost: posts.length === 0 ? 0 : Math.round(totalWords / posts.length),
    totalSources,
    totalFurtherReading,
    longestPost,
    shortestPost,
  };
}
