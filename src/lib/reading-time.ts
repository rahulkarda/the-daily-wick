import readingTimeLib from 'reading-time';

/**
 * Estimate reading time for an article body.
 * Returns a human-friendly string like "2 min read".
 */
export function readingTime(text: string): string {
  const stats = readingTimeLib(text);
  const minutes = Math.max(1, Math.round(stats.minutes));
  return `${minutes} min read`;
}
