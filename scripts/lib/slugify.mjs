/**
 * Slugify — produce a URL-safe kebab-case slug from a string.
 * Stripped down to dependencies-free; lowercase, trims, replaces non-alnum with -.
 */
export function slugify(input) {
  return String(input)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80);
}
