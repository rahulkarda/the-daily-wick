/**
 * URL helper for GitHub Pages subpath deployment.
 *
 * Astro's `base` config (e.g. "/the-daily-wick") is automatically prefixed
 * to asset URLs and to the routes Astro generates, but NOT to hand-coded
 * <a href="/foo"> strings. This helper does that.
 *
 * Use `path('/articles')` instead of `'/articles'` in href/action strings.
 */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

export function path(p: string): string {
  if (!p) return BASE || '/';
  if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('mailto:')) {
    return p;
  }
  // Anchor-only links don't need prefixing
  if (p.startsWith('#')) return p;
  const cleaned = p.startsWith('/') ? p : `/${p}`;
  return `${BASE}${cleaned}`;
}
