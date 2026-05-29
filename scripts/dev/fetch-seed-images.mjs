/**
 * One-shot: fetch real Unsplash photos for the 3 seed posts and update their
 * frontmatter with real photographer credits. Run once, after Unsplash key is set.
 *
 *   node scripts/dev/fetch-seed-images.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

import { fetchHeroImage } from '../lib/unsplash.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const POSTS_DIR = resolve(ROOT, 'src/content/posts');
const IMAGES_DIR = resolve(ROOT, 'src/content/posts/_images');

const SEEDS = [
  { file: '2026-05-26-the-cost-of-half-attention.mdx', slug: 'seed-1-attention',  query: 'single candle dark room' },
  { file: '2026-05-27-useful-friction.mdx',            slug: 'seed-2-friction',   query: 'worn stone path' },
  { file: '2026-05-28-on-the-discipline-of-stillness.mdx', slug: 'seed-3-stillness', query: 'still pond morning fog' },
];

function quote(s) {
  return `"${String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

for (const seed of SEEDS) {
  console.log(`\n→ ${seed.file}  (query: "${seed.query}")`);
  const photo = await fetchHeroImage({
    query: seed.query,
    apiKey: process.env.UNSPLASH_ACCESS_KEY,
    slug: seed.slug,
    outDir: IMAGES_DIR,
  });
  console.log(`   credit:    ${photo.credit.photographer}`);
  console.log(`   alt:       ${photo.alt}`);
  console.log(`   fallback?: ${photo.fallbackUsed}`);

  // Update frontmatter
  const path = resolve(POSTS_DIR, seed.file);
  const raw = await readFile(path, 'utf-8');
  const parsed = matter(raw);
  parsed.data.heroImage = `./_images/${seed.slug}.jpg`;
  parsed.data.heroAlt = photo.alt;
  parsed.data.heroCredit = photo.credit;

  // Re-serialize with our hand-coded YAML to avoid gray-matter quirks
  const fm = parsed.data;
  const lines = [
    '---',
    `title: ${quote(fm.title)}`,
    `subtitle: ${quote(fm.subtitle)}`,
    `pubDate: ${typeof fm.pubDate === 'string' ? fm.pubDate : new Date(fm.pubDate).toISOString().slice(0, 10)}`,
    `tags: [${fm.tags.map(quote).join(', ')}]`,
    `monthlyTheme: ${quote(fm.monthlyTheme)}`,
    `heroImage: ${fm.heroImage}`,
    `heroAlt: ${quote(fm.heroAlt)}`,
    'heroCredit:',
    `  photographer: ${quote(fm.heroCredit.photographer)}`,
    `  photographerUrl: ${quote(fm.heroCredit.photographerUrl)}`,
    `  unsplashUrl: ${quote(fm.heroCredit.unsplashUrl)}`,
  ];
  if (fm.epigraph) {
    lines.push('epigraph:', `  text: ${quote(fm.epigraph.text)}`, `  attribution: ${quote(fm.epigraph.attribution)}`);
  }
  if (fm.sources?.length) {
    lines.push('sources:');
    for (const s of fm.sources) {
      lines.push(`  - label: ${quote(s.label)}`);
      lines.push(`    url: ${quote(s.url)}`);
    }
  }
  if (fm.aiDrafted !== undefined) lines.push(`aiDrafted: ${fm.aiDrafted}`);
  lines.push(`curator: ${quote(fm.curator)}`);
  lines.push('---', '', parsed.content.trim(), '');

  await writeFile(path, lines.join('\n'), 'utf-8');
  console.log(`   updated:   ${path}`);
}

console.log('\nDone. Re-run `npm run build` to regenerate optimized images.');
