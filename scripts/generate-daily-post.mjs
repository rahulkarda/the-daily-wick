/**
 * Daily generation pipeline.
 *
 * Steps:
 *  1. Resolve today's date + monthly theme
 *  2. Bail if today's post already exists (idempotency)
 *  3. Build the prompt (template + theme + recent topics + exemplars)
 *  4. Call Gemini → validate → retry on schema violation
 *  5. Fetch Unsplash hero image
 *  6. Write MDX
 *  7. Update recent-topics state
 *  8. (CI only) Commit + push
 *
 * Run with `--dry-run` to write to tmp/ and skip state + commit.
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateDraft } from './lib/gemini.mjs';
import { fetchHeroImage } from './lib/unsplash.mjs';
import { assembleMdx } from './lib/mdx-writer.mjs';
import { readRecent, appendRecent, summarize } from './lib/recent-topics.mjs';
import { slugify } from './lib/slugify.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');

const POSTS_DIR = DRY_RUN
  ? resolve(ROOT, 'tmp/posts')
  : resolve(ROOT, 'src/content/posts');
const IMAGES_DIR = DRY_RUN
  ? resolve(ROOT, 'tmp/posts/_images')
  : resolve(ROOT, 'src/content/posts/_images');
const THEMES_PATH = resolve(ROOT, 'content/themes/themes.json');
const PROMPT_PATH = resolve(ROOT, 'content/prompts/daily-post.md');
const EXAMPLES_DIR = resolve(ROOT, 'content/prompts/examples');

const CURATOR = process.env.CURATOR_NAME || 'the Editor';

function todayInPT() {
  // Get today's date in America/Los_Angeles timezone as a YYYY-MM-DD-aware Date
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [{ value: y }, , { value: m }, , { value: d }] = fmt.formatToParts(new Date());
  return new Date(`${y}-${m}-${d}T12:00:00Z`); // noon UTC anchor for stability
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function monthKey(d) {
  return d.toISOString().slice(0, 7);
}

async function loadThemes() {
  const data = JSON.parse(await readFile(THEMES_PATH, 'utf-8'));
  return data.themes;
}

async function loadExemplars() {
  if (!existsSync(EXAMPLES_DIR)) return [];
  const files = readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith('.mdx'));
  const out = [];
  for (const f of files) {
    out.push(await readFile(resolve(EXAMPLES_DIR, f), 'utf-8'));
  }
  return out;
}

async function buildPrompt({ today, theme, recent, exemplars }) {
  const template = await readFile(PROMPT_PATH, 'utf-8');
  return template
    .replaceAll('{{DATE}}', isoDate(today))
    .replaceAll('{{MONTHLY_THEME}}', theme.theme)
    .replaceAll('{{MONTHLY_THEME_DESCRIPTION}}', theme.description)
    .replaceAll('{{RECENT_TOPICS}}', summarize(recent))
    .replaceAll('{{EXEMPLARS}}', exemplars.map((ex, i) => `### Exemplar ${i + 1}\n\n${ex}`).join('\n\n---\n\n'))
    .replaceAll('{{CURATOR}}', CURATOR);
}

function postExistsForToday(today) {
  if (!existsSync(POSTS_DIR)) return false;
  const dateStr = isoDate(today);
  const files = readdirSync(POSTS_DIR);
  return files.some((f) => f.startsWith(dateStr));
}

async function main() {
  console.log(`[generate] starting (dry-run=${DRY_RUN})`);

  const today = todayInPT();
  console.log(`[generate] date: ${isoDate(today)}`);

  if (postExistsForToday(today)) {
    console.log('[generate] today already has a post — exiting clean (0).');
    process.exit(0);
  }

  // Resolve monthly theme
  const themes = await loadThemes();
  const mk = monthKey(today);
  const theme = themes.find((t) => t.month === mk);
  if (!theme) {
    console.error(`[generate] no theme defined for ${mk} in themes.json`);
    process.exit(1);
  }
  console.log(`[generate] monthly theme: ${theme.theme} — ${theme.description}`);

  // Build prompt
  const recent = await readRecent();
  const exemplars = await loadExemplars();
  const prompt = await buildPrompt({ today, theme, recent, exemplars });

  // Call Gemini
  console.log('[generate] calling Gemini…');
  const draft = await generateDraft({
    prompt,
    apiKey: process.env.GEMINI_API_KEY,
  });
  console.log(`[generate] draft accepted: "${draft.title}"`);

  // Slug + image
  const slug = slugify(draft.slug || draft.title);
  if (!slug) throw new Error('slug empty after slugify');

  mkdirSync(IMAGES_DIR, { recursive: true });
  const hero = await fetchHeroImage({
    query: draft.imageQuery,
    apiKey: process.env.UNSPLASH_ACCESS_KEY,
    slug,
    outDir: IMAGES_DIR,
  });
  console.log(`[generate] hero: ${hero.relPath} (fallback=${hero.fallbackUsed})`);

  // Assemble MDX
  const tags = (draft.tags || []).map((t) => String(t).toLowerCase());
  const mdx = assembleMdx({
    title: draft.title,
    subtitle: draft.subtitle,
    pubDate: today,
    tags,
    monthlyTheme: theme.theme,
    heroImagePath: hero.fallbackUsed ? hero.relPath : `./_images/${slug}.jpg`,
    heroAlt: hero.alt,
    heroCredit: hero.credit,
    epigraph: draft.epigraph,
    sources: draft.sources || [],
    body: draft.bodyMdx,
    curator: CURATOR,
  });

  mkdirSync(POSTS_DIR, { recursive: true });
  const outPath = resolve(POSTS_DIR, `${isoDate(today)}-${slug}.mdx`);
  await writeFile(outPath, mdx, 'utf-8');
  console.log(`[generate] wrote ${outPath}`);

  if (!DRY_RUN) {
    await appendRecent({
      date: isoDate(today),
      slug,
      tags,
      conceptSummary: draft.themeAlignmentNote || draft.subtitle,
    });
    console.log('[generate] state updated');
  } else {
    console.log('[generate] dry-run — state NOT updated, NO commit');
  }

  console.log('[generate] done.');
}

main().catch((err) => {
  console.error('[generate] FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
