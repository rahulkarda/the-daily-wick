# The Daily Wick

> A small flame, every morning.

A fully-automated daily blog + newsletter for curious minds. One short, careful post — 250-500 words, two to three minutes to read — every weekday morning. Drafted by a language model, edited by a human, delivered to your inbox by 06:30 Pacific time.

Live: **https://rahulkarda.github.io/the-daily-wick/**
Repo: **https://github.com/rahulkarda/the-daily-wick**
Newsletter archive: **https://buttondown.com/the-daily-wick**

---

## What this is

A daily editorial newsletter and blog, in the spirit of [Daily Stoic](https://dailystoic.com), [James Clear's 3-2-1](https://jamesclear.com/3-2-1), [Mark Manson](https://markmanson.net), [Reading Faithfully](https://daily.readingfaithfully.org), [Arnold's Pump Club](https://www.arnoldschwarzenegger.com/newsletter), and [nousimon.com](https://nousimon.com) — but free, open-source, and shipped from a single GitHub Action.

Every issue follows the same shape:

1. **The Idea** — one concept, defined plainly, with an example
2. **One Question** — a single sentence to sit with
3. **Today's Action** — 1-3 concrete things you can do today
4. **Go Deeper** — sourced links if the rabbit hole calls

---

## Architecture (one-page)

```
┌─────────────────────────────┐
│  GitHub Action (06:30 PT,   │
│  cron, weekdays)            │
└──────────────┬──────────────┘
               │
   1. generate-daily-post.mjs
      │
      ├── Gemini 2.5 Flash (REST, free tier)
      │     prompt = master + month theme + recent topics + 3 exemplars
      │     output = JSON, validated by Zod
      │
      ├── Unsplash (search + download hero photo)
      │
      └── writes src/content/posts/YYYY-MM-DD-slug.mdx
          + updates content/state/recent-topics.json
               │
   2. git commit + push to main
               │
   3. GitHub Pages auto-rebuilds the static site (via `.github/workflows/deploy.yml`)
               │
   4. send-daily-newsletter.mjs
      │
      ├── reads today's MDX
      ├── renders email-safe HTML (inline styles, 600px table)
      └── POST https://api.buttondown.com/v1/emails
            email_type: "public" → sends + archives
```

All free tier. Public repo. Zero ongoing cost (until you cross 100 newsletter subscribers, at which point Buttondown's $9/mo plan kicks in).

---

## Quick start (Mac)

```bash
# 1. Clone + install
git clone https://github.com/rahulkarda/the-daily-wick
cd the-daily-wick
nvm use            # Node 22 LTS
npm install

# 2. Local dev
npm run dev        # http://localhost:4321/the-daily-wick/

# 3. Build for production (also runs Pagefind for search)
npm run build
npm run preview    # serves dist/ on http://localhost:4321
```

---

## Required secrets

You need three API keys. All have free tiers.

| Variable                | Where to get it                                                        | Free tier                          |
|-------------------------|------------------------------------------------------------------------|------------------------------------|
| `GEMINI_API_KEY`        | https://aistudio.google.com/apikey                                     | Generous; ~250-1500 RPD            |
| `UNSPLASH_ACCESS_KEY`   | https://unsplash.com/oauth/applications (create a "Demo" app)           | 50 req/hr (we use 2/day)           |
| `BUTTONDOWN_API_KEY`    | https://buttondown.com/settings/programming                            | 100 subscribers free               |

Set them in two places:

**Locally** — copy `.env.example` to `.env` and fill in:
```bash
cp .env.example .env
# edit .env
```

**On GitHub** (so the cron can use them):
```bash
gh secret set GEMINI_API_KEY
gh secret set UNSPLASH_ACCESS_KEY
gh secret set BUTTONDOWN_API_KEY
```

---

## Local commands

| Command                    | What it does                                                |
|----------------------------|-------------------------------------------------------------|
| `npm run dev`              | Astro dev server                                            |
| `npm run build`            | Production build + Pagefind search index                    |
| `npm run preview`          | Serve `dist/` locally                                       |
| `npm run generate:dry-run` | Generate a post into `tmp/` — does NOT commit or update state |
| `npm run generate`         | Full generation pipeline (only run if you mean it)          |
| `npm run send:dry-run`     | Render today's email to `tmp/preview.html`                  |
| `npm run send`             | Send today's newsletter via Buttondown                      |
| `npm test`                 | Run schema + email-render tests                             |
| `npm run typecheck`        | `astro check` (TypeScript + content schema)                 |
| `npm run format`           | Prettier across the repo                                    |

---

## Triggering a manual post

GitHub Actions tab → **Daily post + newsletter** → **Run workflow**. Set `dry_run` to `true` to test without sending.

Or from the CLI:
```bash
gh workflow run daily-post.yml
gh workflow run daily-post.yml -f dry_run=true   # dry-run
```

---

## Updating monthly themes

Edit [`content/themes/themes.json`](content/themes/themes.json):

```json
{
  "themes": [
    { "month": "2026-06", "theme": "Foundations", "description": "Habits, first principles, the things that hold the rest up." },
    { "month": "2026-07", "theme": "Attention",   "description": "Where we look becomes who we are." }
  ]
}
```

Each calendar month picks up the matching `theme` key. The generator passes it to the LLM as a soft constraint — every issue that month should be an angle on the theme.

---

## Reverting a bad post

If a post lands that you'd rather pull:

```bash
git revert HEAD
git push
```

GitHub Pages will rebuild within ~1 minute and the post is gone from the site. Buttondown sends are immutable — if it already went out, send a correction issue.

---

## GitHub Pages setup (already done)

The site is deployed via the [`deploy.yml`](.github/workflows/deploy.yml) workflow — it builds Astro + Pagefind on every push to `main` and publishes the `dist/` artifact to GitHub Pages. The site lives at `https://rahulkarda.github.io/the-daily-wick/`.

If you fork or adapt this:

1. Repo Settings → **Pages** → set **Source** to "GitHub Actions"
2. Push to `main` — the workflow handles the rest
3. Site is live within ~1 minute

---

## Buttondown setup (one-time)

1. Sign up at https://buttondown.com (free tier).
2. Pick a username — recommend `the-daily-wick` so URLs match.
3. Settings → Programming → grab the API key, drop it into GitHub secrets.
4. Update the **embed-subscribe form action** in [`src/components/InlineSubscribe.astro`](src/components/InlineSubscribe.astro) if your handle differs.

---

## Cost & limits

| Service         | Free tier                    | Our usage          |
|-----------------|------------------------------|--------------------|
| Gemini 2.5 Flash | ~250-1500 req/day             | 1 + ≤2 retries     |
| Unsplash demo    | 50 req/hr                     | 2/day              |
| Buttondown       | 100 subscribers, no email cap | Stay under 100     |
| Cloudflare Pages | n/a (using GitHub Pages)      | n/a                |
| GitHub Pages     | unlimited (public repo)       | ~1 build/day       |
| GitHub Actions   | Public repo: unlimited        | ~5 min/day          |

Buttondown's $9/mo upgrade unlocks 1k subs and is the only paid step on the path. Plan to upgrade at ~90 subscribers.

---

## Editorial standards

Every post has a short AI-disclosure footer linking to [`/editorial-standards`](src/pages/editorial-standards.astro), which describes:
- How a post is made (LLM draft → schema validation → human curation → publish)
- Sourcing rules (real quotes, citable stats, no fabrications)
- Image attribution (Unsplash with photographer credit)
- Corrections policy (dated update notes, no silent edits)

---

## Tech

- **Framework:** [Astro](https://astro.build) (static output)
- **Hosting:** [GitHub Pages](https://pages.github.com) (free, deployed via Actions)
- **Search:** [Pagefind](https://pagefind.app) (built at deploy time, zero JS framework)
- **Fonts:** [Fraunces](https://fonts.google.com/specimen/Fraunces) headlines + [Inter](https://rsms.me/inter/) body, self-hosted via `@fontsource`
- **Newsletter:** [Buttondown](https://buttondown.com) free tier
- **LLM:** [Gemini 2.5 Flash](https://ai.google.dev/gemini-api) free tier
- **Images:** [Unsplash API](https://unsplash.com/developers) free tier
- **CI:** GitHub Actions (cron + manual dispatch)

---

## License

MIT — copy, adapt, fork. Attribution appreciated but not required.

---

## Credits

This project distills patterns from these reference sites:
nousimon.com · scotthyoung.com · clearthinking.org · jamesclear.com · markmanson.net · nerdfitness.com · sunnysharma.com · dailystoic.com · daily.readingfaithfully.org · spoonfedstudy.substack.com · arnoldspumpclub.com.
