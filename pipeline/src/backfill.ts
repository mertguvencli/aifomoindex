/**
 * One-off: fill the dataset back to --from (default 2022-10-01) so the index
 * has years of history instead of weeks. Safe to re-run; known items are
 * skipped, and existing Hacker News stories get their final points.
 *
 *   npm run backfill                    # from 2022-10-01
 *   npm run backfill -- --from=2024-01-01
 *   npm run backfill -- --only=deepseek,qwen   # just these labs' archives
 *
 * `--only` skips Hacker News (and so the pruning and rescoring that need it)
 * and merges into the existing coverage instead of rewriting it.
 *
 * It writes data/coverage.json: for each source, the date from which the
 * dataset holds every story. The index only counts a source once a full
 * window and baseline lie inside its coverage, so adding a source never looks
 * like a news spike.
 */
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadSeen, partition } from "./dedup.js";
import { finalize, loadIndex, rescore, rewriteFrontMatter, writeIndex } from "./finalize.js";
import { itemId } from "./hash.js";
import { DATA_DIR, SEEN_PATH } from "./paths.js";
import { refine } from "./refine.js";
import { politeText } from "./polite.js";
import { fetchArticle, mapLimit } from "./sources/article.js";
import { fetchHnRange } from "./sources/hackernews.js";
import { loadConfig } from "./sources/index.js";
import { isArticlePath } from "./sources/page.js";
import { parseFeed } from "./sources/rss.js";
import { keywordTags } from "./tags.js";
import type { NewsItem, RawItem } from "./types.js";

export const COVERAGE_PATH = join(DATA_DIR, "coverage.json");

/**
 * Labs whose archive is listed in a sitemap. Each article page is opened
 * once to read its publish date, since sitemaps only carry last-modified.
 * `partial` archives start after --from, so they never claim coverage.
 */
const SITEMAPS: { name: string; url: string; articlePath: string; partial?: boolean; exclude?: string[] }[] = [
  { name: "anthropic", url: "https://www.anthropic.com/sitemap.xml", articlePath: "/news/" },
  { name: "mistral", url: "https://mistral.ai/sitemap.xml", articlePath: "/news/" },
  { name: "deepmind", url: "https://deepmind.google/sitemap.xml", articlePath: "/blog/" },
  // News pages since mid-2024; earlier releases were posted elsewhere.
  { name: "deepseek", url: "https://api-docs.deepseek.com/sitemap.xml", articlePath: "/news/", partial: true },
  { name: "stability", url: "https://stability.ai/sitemap.xml", articlePath: "/news-updates/" },
  // Research only: /news renders in JavaScript, so the live crawl can't read it,
  // and history must count the same pages the live crawl does.
  { name: "runway", url: "https://runway.com/sitemap.xml", articlePath: "/research/", exclude: ["publications"] },
  // Founded after --from (2024), so the blog is their whole history.
  { name: "bfl", url: "https://bfl.ai/sitemap.xml", articlePath: "/blog/" },
  { name: "worldlabs", url: "https://www.worldlabs.ai/sitemap.xml", articlePath: "/blog/" },
  { name: "wayve", url: "https://wayve.ai/sitemap.xml", articlePath: "/thinking/", exclude: ["press-kit"] },
  { name: "bostondynamics", url: "https://bostondynamics.com/sitemap.xml", articlePath: "/blog/" },
  { name: "agility", url: "https://www.agilityrobotics.com/sitemap.xml", articlePath: "/content/" },
  // Announcements moved here in 2024; earlier ones were on Discord.
  { name: "midjourney", url: "https://updates.midjourney.com/sitemap-posts.xml", articlePath: "/", partial: true },
  // These blogs start years after the company did.
  { name: "figure", url: "https://www.figure.ai/sitemap.xml", articlePath: "/news/", partial: true },
  { name: "pika", url: "https://pika.art/sitemap.xml", articlePath: "/blog/", partial: true },
];

/** Feeds read for history only: archives that stopped updating (Qwen moved to qwen.ai, which renders in JS). */
const ARCHIVE_FEEDS = [{ name: "qwen", url: "https://qwenlm.github.io/blog/index.xml" }];

const get = politeText;

/** Every <loc> in a sitemap, following one level of sitemap index. */
async function sitemapUrls(url: string): Promise<string[]> {
  const xml = await get(url);
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]!);
  if (!/<sitemapindex/i.test(xml)) return locs;
  const nested = await mapLimit(locs, 2, (u) => sitemapUrls(u).catch(() => [] as string[]));
  return nested.flat();
}

const afterFrom = (from: number) => (it: RawItem) => {
  const t = Date.parse(it.publishedAt ?? "");
  return !Number.isNaN(t) && t >= from;
};

async function main(): Promise<void> {
  const fromArg = process.argv.find((a) => a.startsWith("--from="))?.slice(7) ?? "2022-10-01";
  const from = Date.parse(`${fromArg}T00:00:00Z`);
  if (Number.isNaN(from)) throw new Error(`bad --from: ${fromArg}`);
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
  const wanted = (name: string) => !only || only.includes(name);
  const seen = await loadSeen();
  const known = (url: string) => Boolean(seen[itemId(url)]);
  const coverage: Record<string, string> = {};
  const raw: RawItem[] = [];
  /** Every archive page by id, including ones already stored, so a copy filed under Hacker News moves to its lab. */
  const archived = new Map<string, string>();

  let hn: RawItem[] = [];
  if (!only) {
    console.log(`→ Hacker News since ${fromArg}`);
    hn = await fetchHnRange(Math.floor(from / 1000), Math.floor(Date.now() / 1000) + 60);
    console.log(`  ${hn.length} stories`);
    coverage.hackernews = fromArg;
  }

  console.log("→ RSS archives");
  const cfg = await loadConfig();
  for (const feed of [...(cfg.feeds ?? []), ...ARCHIVE_FEEDS].filter((f) => wanted(f.name))) {
    try {
      const items = parseFeed(await get(feed.url), feed.name, Infinity);
      const oldest = Math.min(...items.map((it) => Date.parse(it.publishedAt ?? "")).filter((t) => !Number.isNaN(t)));
      raw.push(...items.filter(afterFrom(from)));
      // A feed that reaches back past --from holds the full archive.
      if (oldest <= from) coverage[feed.name] = fromArg;
      console.log(`  ${feed.name}: ${items.length} items, oldest ${new Date(oldest).toISOString().slice(0, 10)}`);
    } catch (err) {
      console.warn(`  ✗ ${feed.name}: ${err}`);
    }
  }

  console.log("→ Sitemaps");
  for (const sm of SITEMAPS.filter((s) => wanted(s.name))) {
    try {
      const host = new URL(sm.url).hostname.replace(/^www\./, "");
      const urls = (await sitemapUrls(sm.url)).filter((u) => {
        const p = new URL(u);
        return p.hostname.replace(/^www\./, "") === host && isArticlePath(p.pathname, sm.articlePath, sm.exclude);
      });
      for (const u of urls) archived.set(itemId(u), sm.name);
      const todo = urls.filter((u) => !known(u));
      let failed = 0;
      const items = await mapLimit(todo, 4, (u) =>
        fetchArticle(u, sm.name).catch(() => {
          failed++;
          return undefined;
        }),
      );
      const found = items.filter((it): it is RawItem => Boolean(it));
      raw.push(...found.filter(afterFrom(from)));
      if (!sm.partial) coverage[sm.name] = fromArg;
      console.log(`  ${sm.name}: ${urls.length} articles, ${todo.length} new, ${found.length} dated, ${failed} failed`);
    } catch (err) {
      console.warn(`  ✗ ${sm.name}: ${err}`);
    }
  }

  // Labs first, so a lab post that also made Hacker News belongs to the lab.
  const labs = new Map([...archived, ...raw.map((it) => [itemId(it.url), it.source] as const)]);
  raw.push(...hn);

  console.log("→ Add");
  const { fresh } = partition(raw, seen);
  const now = new Date().toISOString();
  // Same keyword refinement as the crawl. No Jev v2 for history: it needs the
  // excerpt at crawl time, and thousands of calls would cost real money.
  const items: NewsItem[] = fresh.map((it) => ({
    ...it,
    ...refine(it),
    id: itemId(it.url),
    fetchedAt: now,
    publishedAt: it.publishedAt ?? now,
  }));
  await finalize(items, seen);
  console.log(`  +${items.length} stories`);

  console.log("→ Rescore and retag");
  const index = await loadIndex();
  // Stories the live crawl filed under Hacker News before the lab's own post
  // was seen go back to the lab, so history and live data count launches alike.
  let moved = 0;
  for (const entry of index) {
    const lab = labs.get(entry.id);
    if (entry.source !== "hackernews" || !lab) continue;
    entry.source = lab;
    await rewriteFrontMatter(entry);
    moved++;
  }
  // Hacker News rows the current query no longer returns (for example "air"
  // stories the old prefix match let in) leave the dataset, so every period
  // is counted with the same query.
  const hnIds = new Set(hn.map((it) => itemId(it.url)));
  let pruned = 0;
  // Without a Hacker News crawl every HN row would look stale, so --only never prunes.
  for (let i = only ? -1 : index.length - 1; i >= 0; i--) {
    const e = index[i]!;
    if (e.source !== "hackernews" || hnIds.has(e.id) || !(Date.parse(e.publishedAt) >= from)) continue;
    index.splice(i, 1);
    delete seen[e.id];
    await rm(join(DATA_DIR, e.path), { force: true });
    pruned++;
  }
  await writeFile(SEEN_PATH, `${JSON.stringify(seen, null, 2)}\n`);

  const rescored = await rescore(index, hn);
  let retagged = 0;
  for (const entry of index) {
    if (entry.tags.length > 0) continue;
    const tags = keywordTags(entry.title, entry.source);
    if (tags.length === 0) continue;
    entry.tags = tags;
    await rewriteFrontMatter(entry);
    retagged++;
  }
  await writeIndex(index);
  console.log(`  moved to labs ${moved}, pruned ${pruned}, points updated on ${rescored}, tags added to ${retagged}`);

  let out = { historyFrom: fromArg, sources: coverage };
  if (only) {
    const prev = JSON.parse(await readFile(COVERAGE_PATH, "utf8")) as typeof out;
    out = { ...prev, sources: { ...prev.sources, ...coverage } };
  }
  await writeFile(COVERAGE_PATH, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`✓ ${index.length} stories. Coverage: ${JSON.stringify(coverage)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
