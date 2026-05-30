/**
 * Newsletter send pipeline.
 *  - Reads today's MDX (most recent file matching today's YYYY-MM-DD)
 *  - Renders email-safe HTML
 *  - Posts to Buttondown's emails endpoint with status: about_to_send
 *  - On --dry-run, writes tmp/preview.html and exits 0
 *
 * Failure-tolerant: if the API errors out, we log + persist failed-sends.json
 * and exit 0 — the post stays committed even if email broke.
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

import { renderEmail } from './lib/email-renderer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');

const POSTS_DIR = resolve(ROOT, 'src/content/posts');
const NEWSLETTER_DIR = resolve(ROOT, 'src/content/newsletter-issues');
const FAILED_PATH = resolve(ROOT, 'content/state/failed-sends.json');

const SITE_URL = process.env.SITE_URL || 'https://rahulkarda.github.io/the-daily-wick';
const BUTTONDOWN_HANDLE = 'the-daily-wick';
const CURATOR = process.env.CURATOR_NAME || 'Rahul Karda';

function todayPT() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [{ value: y }, , { value: m }, , { value: d }] = fmt.formatToParts(new Date());
  return `${y}-${m}-${d}`;
}

function findTodaysPost() {
  if (!existsSync(POSTS_DIR)) return null;
  const date = todayPT();
  const files = readdirSync(POSTS_DIR)
    .filter((f) => f.startsWith(date) && f.endsWith('.mdx'))
    .sort();
  if (files.length === 0) return null;
  return resolve(POSTS_DIR, files[files.length - 1]);
}

function nextIssueNumber() {
  if (!existsSync(NEWSLETTER_DIR)) return 1;
  const files = readdirSync(NEWSLETTER_DIR).filter((f) => f.endsWith('.json'));
  return files.length + 1;
}

async function appendFailure(record) {
  let arr = [];
  if (existsSync(FAILED_PATH)) {
    try {
      arr = JSON.parse(await readFile(FAILED_PATH, 'utf-8'));
    } catch {/* ignore */}
  }
  arr.push(record);
  await writeFile(FAILED_PATH, JSON.stringify(arr, null, 2) + '\n', 'utf-8');
}

async function postToButtondown({ subject, html, preheader }) {
  const apiKey = process.env.BUTTONDOWN_API_KEY;
  if (!apiKey) {
    throw new Error('BUTTONDOWN_API_KEY missing');
  }

  const payload = {
    subject,
    body: html,
    email_type: 'public', // sends + adds to public archive
    status: 'about_to_send',
    metadata: { source: 'the-daily-wick-cron' },
    // Buttondown supports a "secondary_id" field on some plans; safe to omit.
  };

  const res = await fetch('https://api.buttondown.com/v1/emails', {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Buttondown ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json();
}

async function main() {
  console.log(`[send] starting (dry-run=${DRY_RUN})`);

  const postPath = findTodaysPost();
  if (!postPath) {
    console.log(`[send] no post for ${todayPT()} — exiting 0`);
    process.exit(0);
  }
  console.log(`[send] using ${postPath}`);

  const raw = await readFile(postPath, 'utf-8');
  const { data: fm, content: body } = matter(raw);

  const slug = postPath.split('/').pop().replace(/\.mdx$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');

  const { subject, html, preheader } = renderEmail({
    title: fm.title,
    subtitle: fm.subtitle,
    bodyMdx: body,
    epigraph: fm.epigraph,
    monthlyTheme: fm.monthlyTheme,
    curator: fm.curator || CURATOR,
    postSlug: slug,
    pubDate: typeof fm.pubDate === 'string' ? fm.pubDate : new Date(fm.pubDate).toISOString().slice(0, 10),
    siteUrl: SITE_URL,
    buttondownHandle: BUTTONDOWN_HANDLE,
    furtherReading: fm.furtherReading,
  });

  if (DRY_RUN) {
    mkdirSync(resolve(ROOT, 'tmp'), { recursive: true });
    const out = resolve(ROOT, 'tmp/preview.html');
    await writeFile(out, html, 'utf-8');
    console.log(`[send] dry-run preview → ${out}`);
    console.log(`[send] subject: ${subject}`);
    console.log(`[send] preheader: ${preheader}`);
    return;
  }

  try {
    const result = await postToButtondown({ subject, html, preheader });
    console.log(`[send] queued via Buttondown: id=${result.id ?? '(unknown)'}`);

    // Archive marker
    const issueNumber = nextIssueNumber();
    mkdirSync(NEWSLETTER_DIR, { recursive: true });
    const marker = {
      issueNumber,
      sentAt: new Date().toISOString(),
      postSlug: slug,
      buttondownId: result.id,
    };
    await writeFile(
      resolve(NEWSLETTER_DIR, `${String(issueNumber).padStart(4, '0')}.json`),
      JSON.stringify(marker, null, 2) + '\n',
      'utf-8',
    );
    console.log(`[send] archive marker written: issue #${issueNumber}`);
  } catch (err) {
    console.error('[send] FAILED to send:', err.message);
    try {
      await appendFailure({
        date: todayPT(),
        slug,
        subject,
        error: err.message,
        at: new Date().toISOString(),
      });
    } catch (ferr) {
      console.error('[send] could not write failed-sends.json:', ferr.message);
    }
    // Touch a marker the workflow can read to surface the failure as an
    // issue without breaking the publication path. The post stays committed.
    if (process.env.GITHUB_OUTPUT) {
      try {
        const fs = await import('node:fs/promises');
        await fs.appendFile(
          process.env.GITHUB_OUTPUT,
          `send_failed=true\nsend_error=${err.message.replace(/[\n\r]/g, ' ').slice(0, 240)}\n`,
        );
      } catch {/* ignore */}
    }
    // Exit 0 so the post still gets committed in CI
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('[send] CRASHED:', err.message);
  console.error(err.stack);
  process.exit(0); // never fail the CI run
});
