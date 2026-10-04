# AI FOMO Index pipeline

Produces the [`data/`](../data) dataset: **Crawl → Add/Skip → Refine → Finalize**.
Zero heavy dependencies — native `fetch`, `crypto`, and `tsx` to run TypeScript.

## Run locally

```bash
cd pipeline
npm install
npm run crawl          # without a key: no Jev v2 annotations, still writes data
OPENROUTER_KEY=... npm run crawl   # also annotates new items with Jev v2
npm run backfill       # one-off: rebuild history back to 2022-10-01 (or --from=YYYY-MM-DD)
```

The dataset is written to `../data`. Re-running is safe and idempotent: already
seen items are skipped via `data/seen.json`.

## Crawling rules

All requests go through `src/polite.ts`, which obeys robots.txt, spaces requests to each host at
least a second apart, and never retries a 403 or 429. Use it for any new source. To remove a
publisher, add its domain to `blockedHosts` in `sources.config.json`.

## Add a source

- **RSS/Atom feed:** add a line under `feeds` in [`sources.config.json`](./sources.config.json).
- **Lab without a feed:** add a line under `pages` with the news index URL and the path its
  articles live under. The crawler opens new article links and reads their publish date.
  List category pages that sit under the same path in `exclude` (e.g. Runway's `/research/publications`).
- **History:** if the lab's sitemap lists its archive, add the same path to `SITEMAPS` in
  [`src/backfill.ts`](./src/backfill.ts) and run `npm run backfill -- --only=<name>`. Backfill exactly
  the pages the live crawl reads, or history and live data count different things. Mark the entry
  `partial` when the archive starts after 2022-10-01 while the company already existed.
- **Not news:** company blogs that are mostly SEO guides inflate news velocity. Don't crawl them; add
  their host to `LAB_HOSTS` in `src/lib/taxonomy.ts` so their posts on Hacker News are still filed
  under the company. `_considered` in the config lists the ones already checked.
- **Custom source:** export a `Source` (`{ name, fetch() }`) under `src/sources/`
  and register it in `src/sources/index.ts`. See `hackernews.ts` for the pattern.

## Files

```
src/
├── run.ts            orchestrator (the 4 stages in order, plus Hacker News rescoring)
├── backfill.ts       one-off history rebuild from archives; writes data/coverage.json
├── tags.ts           keyword tags
├── crawl.ts          stage 1 — fetch all sources concurrently
├── dedup.ts          stage 2 — Add/Skip
├── refine.ts         stage 3 — keyword tags, points-based importance (no model)
├── finalize.ts       stage 4 — write markdown + index.json + seen.json
├── hash.ts           canonical-URL → stable item id
├── types.ts          shared types + the controlled tag vocabulary
├── paths.ts          dataset path helpers
└── sources/          hackernews.ts, rss.ts, page.ts, article.ts, index.ts (registry)
```
