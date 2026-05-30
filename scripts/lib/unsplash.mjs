/**
 * Hero image picker — multi-query, multi-provider, with relevance scoring.
 *
 * Strategy:
 *   1. Try each Unsplash query in order. For each, fetch up to 10 candidates
 *      and pick the highest-scoring landscape photo with width ≥ 1600.
 *   2. If Unsplash returns nothing usable for any query, fall back to Pexels.
 *   3. If Pexels also fails, use the static OG fallback.
 *
 * Scoring (simple, transparent — easy to tune):
 *   +3 likes/(likes+1) — popularity proxy ("featured" content tends to be sharper
 *   +2 if alt_description / description includes a query keyword
 *   +1 per million pixels above 2 MP, capped at +3
 *   −2 if portrait or square (we want landscape heroes)
 *   −5 if explicit-content flag tripped (Unsplash content_filter handles most)
 */

import { writeFile } from 'node:fs/promises';

const UNSPLASH_SEARCH = 'https://api.unsplash.com/search/photos';
const PEXELS_SEARCH = 'https://api.pexels.com/v1/search';

const UTM = '?utm_source=the_daily_wick&utm_medium=referral';

/**
 * Fetch + download a hero image. Tries each query in order across providers.
 * Returns { filePath, relPath, alt, credit, fallbackUsed, query, source }.
 *
 * Backwards compatible — if `queries` not provided but `query` is, treats
 * it as a single-query list.
 */
export async function fetchHeroImage({
  query,
  queries,
  unsplashKey,
  pexelsKey,
  apiKey, // legacy alias for unsplashKey
  slug,
  outDir,
}) {
  const qs = (queries && queries.length > 0)
    ? queries
    : (query ? [query] : []);
  const ukey = unsplashKey || apiKey;

  if (qs.length === 0) {
    console.warn('[image] no queries — using fallback');
    return fallback();
  }

  // Try Unsplash with each query in order. First good hit wins.
  if (ukey) {
    for (const q of qs) {
      try {
        const photo = await unsplashBest(q, ukey);
        if (photo) {
          const out = await downloadUnsplash(photo, q, ukey, slug, outDir);
          if (out) return out;
        }
      } catch (err) {
        console.warn(`[unsplash] "${q}" failed: ${err.message}`);
      }
    }
  } else {
    console.warn('[image] no Unsplash key — skipping Unsplash');
  }

  // Pexels fallback. Same loop.
  if (pexelsKey) {
    for (const q of qs) {
      try {
        const photo = await pexelsBest(q, pexelsKey);
        if (photo) {
          const out = await downloadPexels(photo, q, slug, outDir);
          if (out) return out;
        }
      } catch (err) {
        console.warn(`[pexels] "${q}" failed: ${err.message}`);
      }
    }
  }

  console.warn('[image] all providers exhausted — using fallback');
  return fallback();
}

// ----- Unsplash --------------------------------------------------------------

async function unsplashBest(query, key) {
  const url = `${UNSPLASH_SEARCH}?query=${encodeURIComponent(query)}&orientation=landscape&per_page=10&content_filter=high`;
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
  });
  if (!res.ok) throw new Error(`Unsplash ${res.status}`);
  const data = await res.json();
  const candidates = (data.results || []).filter((p) => p.width >= 1600);
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => scoreUnsplash(b, query) - scoreUnsplash(a, query));
  return candidates[0];
}

function scoreUnsplash(p, query) {
  const likes = p.likes || 0;
  const popularity = (likes / (likes + 50)) * 3; // 0..3, asymptotic
  const mp = (p.width * p.height) / 1_000_000;
  const sizeBonus = Math.min(3, Math.max(0, mp - 2));
  const aspect = p.width / p.height;
  const aspectBonus = aspect >= 1.4 && aspect <= 1.8 ? 1 : 0;
  const text = `${p.alt_description || ''} ${p.description || ''}`.toLowerCase();
  const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const keywordHits = tokens.filter((t) => text.includes(t)).length;
  const keywordBonus = Math.min(2, keywordHits);
  return popularity + sizeBonus + aspectBonus + keywordBonus;
}

async function downloadUnsplash(photo, query, key, slug, outDir) {
  // Required by Unsplash terms — ping the download_location endpoint.
  fetch(photo.links.download_location, {
    headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
  }).catch(() => {});

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
      photographerUrl: `${photo.user.links.html}${UTM}`,
      unsplashUrl: `${photo.links.html}${UTM}`,
      source: 'unsplash',
    },
    fallbackUsed: false,
    query,
    source: 'unsplash',
  };
}

// ----- Pexels ----------------------------------------------------------------

async function pexelsBest(query, key) {
  const url = `${PEXELS_SEARCH}?query=${encodeURIComponent(query)}&orientation=landscape&per_page=10&size=large`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  const data = await res.json();
  const candidates = (data.photos || []).filter((p) => p.width >= 1600);
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => scorePexels(b, query) - scorePexels(a, query));
  return candidates[0];
}

function scorePexels(p, query) {
  const mp = (p.width * p.height) / 1_000_000;
  const sizeBonus = Math.min(3, Math.max(0, mp - 2));
  const aspect = p.width / p.height;
  const aspectBonus = aspect >= 1.4 && aspect <= 1.8 ? 1 : 0;
  const text = `${p.alt || ''}`.toLowerCase();
  const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const keywordHits = tokens.filter((t) => text.includes(t)).length;
  const keywordBonus = Math.min(2, keywordHits);
  return sizeBonus + aspectBonus + keywordBonus;
}

async function downloadPexels(photo, query, slug, outDir) {
  // Pexels gives several rendition URLs; `large` is typically ~940px wide,
  // `large2x` ~1880, `original` is full-res. Prefer large2x to keep payload small.
  const imgUrl = photo.src.large2x || photo.src.original || photo.src.large;
  const imgRes = await fetch(imgUrl);
  if (!imgRes.ok) throw new Error(`download ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const filePath = `${outDir}/${slug}.jpg`;
  await writeFile(filePath, buf);

  return {
    filePath,
    relPath: `./_images/${slug}.jpg`,
    alt: photo.alt || query,
    credit: {
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url || 'https://www.pexels.com',
      // Re-use the heroCredit.unsplashUrl field for the photo URL — Pexels
      // photos point at pexels.com.
      unsplashUrl: photo.url,
      source: 'pexels',
    },
    fallbackUsed: false,
    query,
    source: 'pexels',
  };
}

// ----- Fallback --------------------------------------------------------------

function fallback() {
  return {
    filePath: 'public/og-default.png',
    relPath: '/og-default.png',
    alt: 'The Daily Wick',
    credit: {
      photographer: 'The Daily Wick',
      photographerUrl: 'https://rahulkarda.github.io/the-daily-wick',
      unsplashUrl: 'https://rahulkarda.github.io/the-daily-wick',
      source: 'fallback',
    },
    fallbackUsed: true,
    query: '',
    source: 'fallback',
  };
}
