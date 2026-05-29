/**
 * Unsplash search + download with proper attribution.
 * Demo tier: 50 req/hr. We use ≤2 req/day per post.
 */

import { writeFile } from 'node:fs/promises';

const SEARCH_URL = 'https://api.unsplash.com/search/photos';

/**
 * Fetch + download a hero image for the given query.
 * Returns { filePath, alt, credit, fallbackUsed }.
 */
export async function fetchHeroImage({ query, apiKey, slug, outDir }) {
  if (!apiKey) {
    console.warn('[unsplash] no API key — using fallback image');
    return fallback();
  }

  try {
    const searchRes = await fetch(
      `${SEARCH_URL}?query=${encodeURIComponent(query)}&orientation=landscape&per_page=10&content_filter=high`,
      { headers: { Authorization: `Client-ID ${apiKey}`, 'Accept-Version': 'v1' } },
    );
    if (!searchRes.ok) throw new Error(`Unsplash ${searchRes.status}`);
    const data = await searchRes.json();
    const photo = (data.results || []).find((p) => p.width >= 1600);
    if (!photo) throw new Error('no suitable photo');

    // Required by Unsplash terms — counts as a download trigger.
    fetch(photo.links.download_location, {
      headers: { Authorization: `Client-ID ${apiKey}`, 'Accept-Version': 'v1' },
    }).catch(() => {/* swallow — this is a fire-and-forget side-effect */});

    const imgRes = await fetch(photo.urls.regular);
    if (!imgRes.ok) throw new Error(`download ${imgRes.status}`);
    const buf = Buffer.from(await imgRes.arrayBuffer());

    const filePath = `${outDir}/${slug}.jpg`;
    await writeFile(filePath, buf);

    return {
      filePath,
      relPath: `./_images/${slug}.jpg`,
      alt: photo.alt_description || query,
      credit: {
        photographer: photo.user.name,
        photographerUrl: `${photo.user.links.html}?utm_source=the_daily_wick&utm_medium=referral`,
        unsplashUrl: `${photo.links.html}?utm_source=the_daily_wick&utm_medium=referral`,
      },
      fallbackUsed: false,
    };
  } catch (err) {
    console.warn(`[unsplash] fetch failed: ${err.message} — using fallback`);
    return fallback();
  }
}

function fallback() {
  return {
    filePath: 'public/og-default.png',
    relPath: '/og-default.png',
    alt: 'The Daily Wick',
    credit: {
      photographer: 'The Daily Wick',
      photographerUrl: 'https://rahulkarda.github.io/the-daily-wick',
      unsplashUrl: 'https://rahulkarda.github.io/the-daily-wick',
    },
    fallbackUsed: true,
  };
}
