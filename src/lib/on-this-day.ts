/**
 * "On this day" — find back-catalogue posts published an exact-ish number
 * of months / years ago. Returns up to one post per anchor (1y, 6mo, 1mo).
 *
 * Anchors are computed against today (UTC, anchored at noon to dodge DST).
 * For each anchor we pick the closest pubDate within ±3 days — that way
 * publishing on Tue while the year-ago post landed on Wed still counts.
 */
import type { CollectionEntry } from 'astro:content';

type Post = CollectionEntry<'posts'>;

export interface Anchor {
  label: string; // human-readable, e.g. "A year ago today"
  ago: string; // short text, e.g. "1y"
  post: Post;
  daysOff: number; // 0 = exact day-of-year match
}

/** Nudge a date by N months (clamping day to last-of-month if needed). */
function shiftMonths(base: Date, months: number): Date {
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const d = base.getUTCDate();
  const target = new Date(Date.UTC(y, m - months, d, 12, 0, 0));
  // If the day overflowed (Mar 31 - 1mo = Feb 31 → Mar 3), pin to last-of-month.
  if (target.getUTCMonth() !== ((m - months) % 12 + 12) % 12) {
    target.setUTCDate(0);
    target.setUTCHours(12);
  }
  return target;
}

const MS_PER_DAY = 86_400_000;

export function findOnThisDay(posts: Post[], today: Date = new Date()): Anchor[] {
  // Anchor today at noon UTC for stable arithmetic.
  const anchorToday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12, 0, 0),
  );

  const targets: { label: string; ago: string; date: Date }[] = [
    { label: 'A year ago today', ago: '1y', date: shiftMonths(anchorToday, 12) },
    { label: 'Six months ago', ago: '6mo', date: shiftMonths(anchorToday, 6) },
    { label: 'A month ago', ago: '1mo', date: shiftMonths(anchorToday, 1) },
  ];

  const out: Anchor[] = [];
  const used = new Set<string>(); // dedupe so the same post doesn't appear under two anchors
  for (const t of targets) {
    let best: { post: Post; daysOff: number } | null = null;
    for (const p of posts) {
      if (used.has(p.slug)) continue;
      const daysOff = Math.abs(
        Math.round((p.data.pubDate.valueOf() - t.date.valueOf()) / MS_PER_DAY),
      );
      if (daysOff > 3) continue;
      if (!best || daysOff < best.daysOff) {
        best = { post: p, daysOff };
      }
    }
    if (best) {
      out.push({ label: t.label, ago: t.ago, post: best.post, daysOff: best.daysOff });
      used.add(best.post.slug);
    }
  }
  return out;
}
