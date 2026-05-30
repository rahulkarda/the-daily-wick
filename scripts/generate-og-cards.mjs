#!/usr/bin/env node
/**
 * generate-og-cards.mjs
 *
 * Generate per-post Open Graph card images (1200x630 PNG) for The Daily Wick.
 *
 * - Reads every src/content/posts/*.mdx, parses frontmatter via gray-matter.
 * - Composites with sharp:
 *     1. Cream background (#F8F4EC)
 *     2. Hero photo (frontmatter heroImage), filling the canvas, blurred,
 *        tinted toward cream so it sits as a soft backdrop.
 *     3. SVG text overlay: brand strip, title (wrapped), epigraph (wrapped),
 *        format pill, URL.
 * - Writes to public/og/{slug}.png. Astro copies public/ -> dist/ at build.
 * - Incremental: skips a card if it exists and its mtime is newer than the
 *   source MDX. Pass --force to regenerate everything.
 *
 * Pure Node + sharp + gray-matter. No new dependencies.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(PROJECT_ROOT, 'src', 'content', 'posts');
const OUT_DIR = path.join(PROJECT_ROOT, 'public', 'og');

const FORCE = process.argv.includes('--force');

const WIDTH = 1200;
const HEIGHT = 630;

// ---------- helpers ----------

/** Escape XML special characters for embedding text in SVG. */
function escapeXml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Wrap a string into <= maxLines lines, each <= maxChars wide. Truncates the
 * final line with an ellipsis if the input doesn't fit.
 *
 * Returns an array of plain strings (not yet xml-escaped).
 */
function wrapText(text, maxChars, maxLines) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (current.length + 1 + word.length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);

  // If we ran out of room, ellipsize the last line.
  const consumed = lines.join(' ').split(/\s+/).filter(Boolean).length;
  if (consumed < words.length) {
    let last = lines[maxLines - 1] || '';
    // Drop words from the end of last line until "…" fits.
    while (last.length > 0 && last.length + 1 > maxChars - 1) {
      const parts = last.split(' ');
      parts.pop();
      last = parts.join(' ');
    }
    lines[maxLines - 1] = (last ? last + ' ' : '') + '…';
  }
  return lines;
}

/**
 * Build SVG overlay with brand strip, title, epigraph, format pill, URL.
 */
function buildOverlaySvg({ title, epigraph, format }) {
  const titleLines = wrapText(title, 28, 3);
  const titleSvg = titleLines
    .map((line, i) => {
      const dy = i === 0 ? 0 : 64; // 56px font-size * ~1.14 line-height
      return `<tspan x="60" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join('');

  let epigraphBlock = '';
  if (epigraph && epigraph.text) {
    const epLines = wrapText(epigraph.text, 60, 2);
    const epSvg = epLines
      .map((line, i) => {
        const dy = i === 0 ? 0 : 28; // 24px font-size * ~1.16
        return `<tspan x="80" dy="${dy}">${escapeXml(line)}</tspan>`;
      })
      .join('');
    const attribution = epigraph.attribution
      ? `<text x="80" y="475" font-family="Inter, sans-serif" font-size="18" fill="#6B6258">— ${escapeXml(epigraph.attribution)}</text>`
      : '';
    epigraphBlock = `
      <line x1="60" y1="380" x2="60" y2="450" stroke="#B5563A" stroke-width="3"/>
      <text x="80" y="408" font-family="Fraunces, Georgia, serif" font-style="italic" font-size="24" fill="#1A1612">${epSvg}</text>
      ${attribution}
    `;
  }

  const formatLabel = String(format || 'micro').toUpperCase();
  // Width the pill to the label so it doesn't look stretched/squished.
  const pillWidth = Math.max(96, formatLabel.length * 14 + 32);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <text x="60" y="60" font-family="Inter, sans-serif" font-size="18" fill="#6B6258" letter-spacing="2">THE DAILY WICK · A SMALL FLAME, EVERY MORNING</text>
  <text x="60" y="200" font-family="Fraunces, Georgia, serif" font-size="56" font-weight="600" fill="#1A1612">${titleSvg}</text>
  ${epigraphBlock}
  <rect x="60" y="540" rx="20" ry="20" width="${pillWidth}" height="36" fill="#B5563A" fill-opacity="0.12"/>
  <text x="${60 + pillWidth / 2}" y="563" font-family="Inter, sans-serif" font-size="14" fill="#B5563A" letter-spacing="2" text-anchor="middle">${escapeXml(formatLabel)}</text>
  <text x="1140" y="563" font-family="Inter, sans-serif" font-size="14" fill="#6B6258" text-anchor="end">rahulkarda.github.io/the-daily-wick</text>
</svg>`;
}

/**
 * Resolve the heroImage frontmatter value (e.g. "./_images/foo.jpg") to an
 * absolute path. Relative to the post's directory.
 */
function resolveHeroPath(postFile, heroImage) {
  if (!heroImage) return null;
  if (path.isAbsolute(heroImage)) return heroImage;
  return path.resolve(path.dirname(postFile), heroImage);
}

/**
 * Build the hero backdrop layer: photo scaled to fill 1200x630, blurred,
 * then tinted toward cream by compositing a 70%-opaque cream rectangle on
 * top. Net effect: hero shows through at ~30%, sits behind the text without
 * fighting it.
 */
async function buildHeroBackdrop(heroPath) {
  let heroBuffer;
  try {
    heroBuffer = await sharp(heroPath)
      .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'attention' })
      .blur(20)
      .toBuffer();
  } catch {
    return null;
  }

  // Cream tint at 70% — the photo behind it ends up at ~30% perceived intensity.
  const tintSvg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#F8F4EC" fill-opacity="0.7"/>
  </svg>`;

  return await sharp(heroBuffer)
    .composite([{ input: Buffer.from(tintSvg) }])
    .png()
    .toBuffer();
}

/** Render one post's OG card to disk. */
async function renderCard(postFile) {
  const raw = await fs.readFile(postFile, 'utf8');
  const { data } = matter(raw);

  const slug = path.basename(postFile, '.mdx');
  const outPath = path.join(OUT_DIR, `${slug}.png`);

  // Incremental: skip if up-to-date.
  if (!FORCE) {
    try {
      const [outStat, srcStat] = await Promise.all([
        fs.stat(outPath),
        fs.stat(postFile),
      ]);
      if (outStat.mtimeMs >= srcStat.mtimeMs) {
        return { slug, status: 'skipped', outPath };
      }
    } catch {
      // out file missing — fall through and render.
    }
  }

  const heroPath = resolveHeroPath(postFile, data.heroImage);
  const overlaySvg = buildOverlaySvg({
    title: data.title || slug,
    epigraph: data.epigraph,
    format: data.format,
  });

  // Start with cream canvas.
  let pipeline = sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: { r: 0xf8, g: 0xf4, b: 0xec },
    },
  });

  const composites = [];
  if (heroPath) {
    const backdrop = await buildHeroBackdrop(heroPath);
    if (backdrop) composites.push({ input: backdrop, top: 0, left: 0 });
  }
  composites.push({ input: Buffer.from(overlaySvg), top: 0, left: 0 });

  await pipeline.composite(composites).png().toFile(outPath);

  return { slug, status: 'rendered', outPath };
}

// ---------- main ----------

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const entries = await fs.readdir(POSTS_DIR);
  const posts = entries
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => path.join(POSTS_DIR, f));

  if (posts.length === 0) {
    console.log('[og] no posts found; nothing to do');
    return;
  }

  let rendered = 0;
  let skipped = 0;
  for (const p of posts) {
    try {
      const result = await renderCard(p);
      if (result.status === 'rendered') {
        rendered++;
        console.log(`[og] rendered  ${result.slug}`);
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[og] FAILED   ${path.basename(p)}: ${err.message}`);
      throw err;
    }
  }
  console.log(
    `[og] done. ${rendered} rendered, ${skipped} up-to-date, ${posts.length} total -> public/og/`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
