# AI FOMO Index architecture

Fully OSS, fully GitHub-native. No servers, no hosting bill: GitHub Actions is
the cron, the repo is the database, GitHub Pages is the CDN.

```
            ┌─────────────────────── GitHub Actions (cron, every 6h) ───────────────────────┐
            │                                                                                │
  sources ─▶│  Crawl ─▶ Add/Skip ─▶ Refine ─▶ Finalize  ─▶  commit data/ back to the repo   │
  (HN, RSS) │  (fetch)  (dedup)    (LLM, opt) (write md)                                     │
            └────────────────────────────────────────────────────────────────────────────────┘
                                              │ push to data/**
                                              ▼
            ┌─────────────── GitHub Actions (deploy-pages) ───────────────┐
            │  next build (output: export) ─▶ ./out ─▶ GitHub Pages       │
            └─────────────────────────────────────────────────────────────┘
```

## The pipeline (`pipeline/`)

Four stages, one per file, orchestrated by `src/run.ts`:

| Stage | File | Does |
| --- | --- | --- |
| Crawl | `crawl.ts` + `sources/` | Fetch every source concurrently; one failure is skipped, not fatal. |
| Add/Skip | `dedup.ts` | Drop items already in `seen.json` and batch-internal dupes — **before** the LLM, so we never pay to refine something we'll skip. |
| Refine | `refine.ts` | Legacy optional headline tagging/importance via a model; heuristic fallback without a key. No generated summaries. |
| Finalize | `finalize.ts` | Write one markdown file per item; refresh `index.json` and `seen.json`. |

Sources are pluggable: every RSS feed and news page listed in
`pipeline/sources.config.json`, plus Hacker News. Adding one is a one-line PR. Labs are crawled
before Hacker News, so a lab post that also made Hacker News belongs to the lab. Each run also
re-reads the last three days of Hacker News and refreshes the points of stories already stored.

Every request goes through `pipeline/src/polite.ts`: it obeys robots.txt, sends one request per
host at a time at least a second apart, uses an honest user agent, and gives up on a host after a
403 or 429. `blockedHosts` in the config removes a publisher's stories and keeps them out.

History before the live crawl comes from `pipeline/src/backfill.ts`, a one-off that reads whatever
archive each source exposes (feeds, sitemaps, the Hacker News search API) with the same rules and
writes `data/coverage.json`. The archives are not audited for completeness; see
[known coverage gaps](data/README.md#known-coverage-gaps).

## The dataset (`data/`)

See [data/README.md](data/README.md). `index.json` is the API; the markdown files
are the forkable source of truth; `seen.json` is the dedup ledger.

## The site (`src/`)

A Next.js static export. `src/lib/dataset.ts` reads `data/index.json` at build
time and `src/app/page.tsx` renders it through `src/components/feed/`. The research overview is server-rendered at build time. The separate `/feed` corpus explorer lazily downloads the archive after hydration.

The AI FOMO Index (`src/lib/fomo-index.ts`, see [docs/fomo-index.md](docs/fomo-index.md)) is
computed at build time too. Each build emits it in several forms:

| Output | Source | Use |
| --- | --- | --- |
| Research overview on `/` | `src/components/feed/fomo-hero.tsx` | The site itself |
| `/fomo.json` | `src/app/fomo.json/route.ts` | Public API |
| `/research.json` | `src/lib/research.ts` | Provenance fingerprints, source composition and current-snapshot sensitivity |
| `/badge.json` | `src/app/badge.json/route.ts` | shields.io endpoint badge |
| `/og.png` | `src/app/og.png/route.tsx` | Share preview with the current score |

The site URL and repo URL live in `src/lib/site.ts`.

## Two licenses

- **Code** — MIT (`LICENSE`).
- **Dataset** — CC BY 4.0 (`data/LICENSE`). Records retain attributed headlines and URLs; full article bodies are never reproduced.

## Operational notes

- **Secrets & forks.** `ANTHROPIC_API_KEY` is an Actions secret. Forks and PRs
  can't read it, so refinement is written to degrade gracefully — the pipeline
  always emits a valid dataset, enriched or not.
- **Git history.** Every crawl commits to `data/`. If history grows
  uncomfortable, move raw crawl output to an orphan `data` branch or Releases and
  keep only the curated `index.json` + markdown on `main`.
- **Scheduled-workflow death.** GitHub disables `schedule:` workflows after 60
  days of repo inactivity. Active OSS repos won't hit this.
- **Site URL.** The site is served at `mertguvencli.github.io/aifomoindex` until a custom domain is
  set under repo Settings → Pages. Actions-based Pages deploys ignore a `CNAME` file. The deploy and
  post workflows read the base path and URL from the Pages settings (`actions/configure-pages`), so
  attaching a domain needs no code change. Only the links in the README are hard-coded.

## Research and semantic pilot

The canonical methodology text is `src/content/methodology.md`. `METHOD_VERSION`
labels the unchanged numerical baseline. `src/lib/research.ts` computes current
source/signal exclusions and hashes data and calculation files for a reproducible
snapshot. Hashes require the matching repository commit; they are not archives.

`scripts/semantic-pilot.mjs` runs separately from crawling and building. Its
`--execute` flag makes bounded TypeSafe calls using the pinned model/rubric in
`scripts/semantic/jev.mjs`. Default execution only prepares a local plan and human
annotation template. Model outputs never flow into `data/index.json` or the index.
See `docs/semantic-pilot.md` for validation gates and limitations.

The site build uses Node.js 24 and verifies exported artifacts after Next finishes.
The deployment workflow runs the regression/unit tests before building.
