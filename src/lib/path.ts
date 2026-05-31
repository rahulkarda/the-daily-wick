/**
 * URL helper for GitHub Pages subpath deployment.
 *
 * Astro's `base` config (e.g. "/the-daily-wick") is automatically prefixed
 * to asset URLs and to the routes Astro generates, but NOT to hand-coded
 * <a href="/foo"> strings. This helper does that.
 *
 * Use `path('/articles')` instead of `'/articles'` in href/action strings.
 *
 * Note: trailingSlash is 'never' in astro.config.mjs, so this helper
 * strips any trailing slash from the result (e.g. path('/') → '/the-daily-wick'
 * not '/the-daily-wick/'). This prevents 404s in dev and on GitHub Pages.
 */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

export function path(p: string): string {
  if (!p) return BASE || '/';
  if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('mailto:')) {
    return p;
  }
  if (p.startsWith('#')) return p;
  const cleaned = p.startsWith('/') ? p : `/${p}`;
  const full = `${BASE}${cleaned}`;
  // Strip trailing slash to stay consistent with trailingSlash: 'never'.
  // Exception: bare '/' becomes BASE (e.g. '/the-daily-wick'), never empty string.
  if (full === '/') return BASE || '/';
  return full.endsWith('/') ? full.slice(0, -1) : full;
}
