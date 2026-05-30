/**
 * Streak math — extracted to a plain .mjs so tests can run without TS.
 * Imported by src/lib/stats.ts and re-exported as part of computeStats.
 */

/**
 * True if `b` falls on the next *expected* publish day after `a`:
 * Mon→Tue, Tue→Wed, Wed→Thu, Thu→Fri, Fri→Mon. Posts published on Sat/Sun
 * are unusual but tolerated; they never extend a streak on their own.
 */
export function isNextPublishDay(a, b) {
  const dayA = a.getUTCDay();
  const msPerDay = 86_400_000;
  const diff = Math.round(
    (Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) -
      Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())) /
      msPerDay,
  );
  if (diff <= 0) return false;
  // Friday → Monday (skip Sat/Sun)
  if (dayA === 5) return diff === 3;
  // Saturday or Sunday: not a publish day, can't extend a streak
  if (dayA === 0 || dayA === 6) return false;
  // Mon-Thu → next day
  return diff === 1;
}

/**
 * Compute the longest run of consecutive *publishing days* — Mon-Fri.
 * Returns { length, start, end } or null when fewer than 1 post.
 */
export function computeStreak(posts) {
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
