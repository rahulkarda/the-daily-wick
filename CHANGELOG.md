# Changelog

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
