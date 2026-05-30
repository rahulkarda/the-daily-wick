/**
 * Theme + tag helpers — used by archive views, /themes pages, and filter chips.
 * One source of truth for the slug/display mapping so links survive renames.
 */

export function themeSlug(theme: string): string {
  return theme
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Group an array of posts by their monthlyTheme.
 * Returns Map<themeName, posts[]> — Map preserves insertion order, so the
 * caller can sort once and rely on a stable key order downstream.
 */
export function groupByTheme<T extends { data: { monthlyTheme: string } }>(
  posts: T[],
): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const p of posts) {
    const key = p.data.monthlyTheme;
    const list = out.get(key) ?? [];
    list.push(p);
    out.set(key, list);
  }
  return out;
}

/**
 * Group posts by tag (one post may appear under multiple tags).
 * Returns sorted entries [tag, posts[]] descending by post count.
 */
export function groupByTag<T extends { data: { tags: string[] } }>(
  posts: T[],
): [string, T[]][] {
  const out = new Map<string, T[]>();
  for (const p of posts) {
    for (const t of p.data.tags) {
      const list = out.get(t) ?? [];
      list.push(p);
      out.set(t, list);
    }
  }
  return [...out.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}
