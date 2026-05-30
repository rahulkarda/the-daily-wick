# Changelog

## v0.4.0 — 2026-05-30

Tier 3 polish — alive surfaces, transparency, and shareable cards.

- **"On this day"** — homepage strip surfaces posts published 1y / 6mo / 1mo
  ago today (±3 days). Hidden until the catalogue catches up. Each anchor
  picks the closest post and dedupes across anchors.
- **Random quote rotator** — homepage block pulls a random epigraph from
  the back catalogue with a "from {post title} →" link. Click "↻ Another"
  to refresh. Aria-live polite. Hidden when no posts have epigraphs.
- **Drop caps on essays** — Tufte-style serif drop cap on the first
  paragraph of every essay-format post. Scoped via `[data-format='essay']`
  so micros are untouched. Mobile-aware sizing; print-aware override.
- **Post DNA block** — collapsible "how this was made" footer on every
  post: model, generation time (seconds), output token count, image
  source + which of the three queries hit, reading time. Schema field is
  optional; old posts without `dna` are unaffected.
- **OG cards** — every post gets a 1200×630 PNG generated at build time
  via sharp. Title in serif, epigraph (italic, accent-bordered), format
  pill, and the URL strip. Build script `scripts/generate-og-cards.mjs`
  runs before `astro build` (mtime-incremental). `public/og/` is
  gitignored — regenerated on every CI run.
- Gemini wrapper now returns `{ draft, usage }` so the generator can record
  output token counts in DNA without adding a second call.

## v0.3.0 — 2026-05-30

Tier 1 + Tier 2 polish from the post-launch review.

### Tier 1 — discovery + ops
- **`/stats`** page — totals, top-12 tag bar chart, theme distribution,
  longest publish streak (Mon-Fri-aware), longest/shortest bookend posts.
  Pure server-render; no JS.
- **`/start-here`** — curated reading path driven by `content/start-here.json`.
  Hand-pickable steps with a "why" per post and an estimated total time.
- **Reading-progress bar** — thin accent line that grows as you scroll
  through an article. Tracks the `<article>` bounds so it hits 100% exactly
  when the last paragraph leaves the viewport.
- **Print stylesheet** — clean B&W print/PDF layout. Hides nav/footer/
  reactions/share/AI-disclosure/related/subscribe/search. Expands link
  URLs after each link so printed copies are self-contained.
- **Failure alerting** — when the daily cron fails, the workflow opens (or
  comments on) a `daily-post-failure`-labelled GitHub issue. Re-uses an open
  issue across consecutive failures so the inbox doesn't get spammed.

### Tier 2 — depth
- **Series / multi-part arcs** — opt-in `series: { slug, part }` field on
  posts. `/series` index + `/series/[slug]` detail pages. SeriesNav inside
  every series-tagged post: full TOC + Prev/Next pager. Series declared in
  `content/series/series.json`.
- **Pollinations.ai third image tier** — when both Unsplash and Pexels miss,
  the picker generates an editorial-style hero with Pollinations.ai (free,
  no key). Deterministic seed-from-slug so re-runs produce the same image.
  Disable with \`POLLINATIONS_DISABLED=1\`.
- **"Where this came from" provenance** — optional `provenance` frontmatter
  field renders a one-line breadcrumb under the byline ("Builds on Sophie
  Leroy's attention-residue paper"). Auto-derived from `sources[0]` if not
  set. Gemini fills it on most drafts.

## v0.2.0 — 2026-05-30

Two-feed expansion: more variety, better discovery.

- **Two parallel formats**: `micro` (200-350w, the daily) + `essay` (900-1500w, deep dive). Format rotates Mon/Wed/Fri = micro, Tue/Thu = essay; override with `FORMAT=` env var.
- **Per-format prompt + validation**: Gemini drafts to a different section template per format; word-count + section validators are format-aware.
- **Multi-query image picker**: Gemini now suggests 3 distinct hero queries; the picker tries each on Unsplash, scores by popularity / aspect / size / keyword fit, and falls back to Pexels if Unsplash returns nothing usable for any query.
- **`furtherReading`**: new structured field — books, essays, papers, podcasts, videos, sites — with optional one-line "why" notes. Renders as an "If this hooked you" sidebar on every post and as a styled block in the email.
- **Theme + tag sorting**: new `/themes` index, `/themes/[theme]` landing pages. Archive page gets three view tabs (by date / by theme / by tag). `/articles` gets format + theme filter chips with hash-restored state.
- **Reactions**: 5-emoji reaction strip per post — love / made me think / new idea / will re-read / inspired. Saved to localStorage on the reader's device. No fake global counts.
- **Random post**: new `/random` page picks one post uniformly and redirects there. Added to the footer nav.
- **Curator**: byline now reads "Rahul Karda" everywhere (was "the Editor").
- **Format pill** + theme tag in PostMeta + archive list.
- **PEXELS_API_KEY** env optional — sign-up at https://www.pexels.com/api/ when ready.
- **Tests**: schema tests cover both formats, image-query shape, furtherReading shape; email tests cover the new block and curator name.
- All 23 tests passing. 22 pages built.

## v0.1.0 — 2026-05-29

Initial scaffold.

- Astro static site, Cloudflare Pages target, public GitHub repo
- Warm-cream theme with serif headlines (Fraunces) + sans body (Inter)
- Light + dark mode (system + manual toggle, no FOUC)
- Pages: home (card grid), articles (paginated), articles/[slug], topics/[tag], archive (year/month accordion), about, subscribe, faq, editorial-standards, 404, /rss.xml
- Pagefind search (Cmd/Ctrl+K modal)
- Three hand-authored seed posts that double as Gemini exemplars
- Daily generation pipeline: Gemini 2.5 Flash → schema validate → Unsplash hero → MDX write → state update
- Newsletter pipeline: MDX → email-safe inline-styled HTML → Buttondown (`email_type: public`)
- GitHub Actions: weekday cron at 13:30 UTC + manual `workflow_dispatch` with `dry_run` input
- Tests: schema validation + email render snapshot
- Master prompt with banned-phrases list, voice rules, format spec, three exemplars
- 12 months of monthly themes pre-seeded
