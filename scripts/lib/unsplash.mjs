/**
 * Hero image picker — multi-query, multi-provider, with relevance scoring.
 *
 * Strategy (in order):
 *   1. Try each Unsplash query. Pick the highest-scoring landscape photo
 *      with width >= 1600.
 *   2. If Unsplash returns nothing usable for any query, fall back to Pexels.
 *   3. If Pexels also fails (or no key), generate a hero with Pollinations.ai
 *      (free, no key required). The prompt is the first imageQuery padded
 *      with style hints to keep things consistent across the site.
 *   4. If Pollinations fails too, use the static OG fallback.
 *
 * Scoring (simple, transparent — easy to tune):
 *   +3 likes/(likes+1) — popularity proxy
 *   +2 if alt_description / description includes a query keyword
 *   +1 per million pixels above 2 MP, capped at +3
 *   −2 if portrait or square (we want landscape heroes)
 */

import { writeFile } from 'node:fs/promises';

const UNSPLASH_SEARCH = 'https://api.unsplash.com/search/photos';
const PEXELS_SEARCH = 'https://api.pexels.com/v1/search';
const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';

// Style preamble for AI generation: editorial, muted, on-brand.
// Kept short so the user query stays the dominant signal.
const POLLINATIONS_STYLE =
  'editorial photograph, warm natural light, muted earth tones, shallow depth of field, no text, no logos, cinematic';

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

  // Pollinations fallback — AI-generated hero. No key required, but rate-
  // limited (single GET, retry once). Skip if PIPELINE has the env var
  // POLLINATIONS_DISABLED=1 (escape hatch in case the service is broken).
  if (process.env.POLLINATIONS_DISABLED !== '1') {
    try {
      const out = await downloadPollinations(qs[0], slug, outDir);
      if (out) return out;
    } catch (err) {
      console.warn(`[pollinations] failed: ${err.message}`);
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

// ----- Pollinations.ai (AI generation, no key) ------------------------------

/**
 * Build a deterministic seed from the slug so re-runs produce the same image
 * (avoids "the post drifts every CI run"). 32-bit unsigned int.
 */
function seedFromSlug(slug) {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

async function downloadPollinations(query, slug, outDir) {
  const prompt = `${query}, ${POLLINATIONS_STYLE}`;
  const seed = seedFromSlug(slug);
  // 1600x900 is on-brand and matches the stock-photo aspect we use elsewhere.
  const url =
    `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}` +
    `?width=1600&height=900&nologo=true&seed=${seed}&model=flux`;

  // Tight timeout — 30s. The whole workflow only has 10 minutes, and a
  // 60s wait on a flaky service eats too much of that budget.
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 30_000);
  let imgRes;
  try {
    imgRes = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
  if (!imgRes.ok) throw new Error(`pollinations ${imgRes.status}`);

  // Validate Content-Type before reading body — a fast fail if the service
  // returned an HTML error page despite a 200 status.
  const ct = imgRes.headers.get('content-type') || '';
  if (!/^image\//i.test(ct)) {
    throw new Error(`pollinations returned non-image content-type: ${ct}`);
  }

  const buf = Buffer.from(await imgRes.arrayBuffer());
  // Sanity check the magic bytes. JPEG starts with 0xFF 0xD8 0xFF. PNG with
  // 0x89 0x50 0x4E 0x47. Pollinations serves JPEG by default but accept PNG
  // defensively — the file extension is .jpg either way; sharp/Astro will
  // re-encode at build time.
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng =
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (!isJpeg && !isPng) {
    throw new Error(`pollinations payload not JPEG/PNG (first bytes: ${buf.slice(0, 4).toString('hex')})`);
  }
  // 8 KB minimum — generous enough for a legitimate small flux image,
  // tight enough to catch tiny error sentinels.
  if (buf.length < 8_000) {
    throw new Error(`pollinations payload too small (${buf.length} bytes)`);
  }

  const filePath = `${outDir}/${slug}.jpg`;
  await writeFile(filePath, buf);

  return {
    filePath,
    relPath: `./_images/${slug}.jpg`,
    alt: query,
    credit: {
      photographer: 'AI illustration (Pollinations.ai)',
      photographerUrl: 'https://pollinations.ai',
      // Link to the Pollinations homepage rather than the prompt URL — the
      // prompt URL leaks our image-query verbatim and isn't a "credit" page.
      // The full prompt is preserved in CHANGELOG/git history if needed.
      unsplashUrl: 'https://pollinations.ai',
      source: 'pollinations',
    },
    fallbackUsed: false,
    query,
    source: 'pollinations',
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
