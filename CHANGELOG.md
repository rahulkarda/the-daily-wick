# Changelog

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
