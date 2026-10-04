/**
 * One-off: annotate the existing dataset with Jev v2. Lab items get their RSS
 * description when the feed still lists them (OpenAI's goes back to 2015), else
 * their page's meta description, both read politely as the crawl does. Hacker
 * News items have no excerpt, as in the crawl. Excerpts stay in memory for one
 * chunk and are never written. Resumable: ids already in the v2 journal are
 * skipped, so rerunning picks up where a stopped run left off.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { annotateFresh } from "../../scripts/semantic/annotate-fresh.mjs";
import { loadIndex } from "./finalize.js";
import { DATA_DIR } from "./paths.js";
import { politeText } from "./polite.js";
import { mapLimit, meta } from "./sources/article.js";
import { loadConfig } from "./sources/index.js";
import { parseFeed } from "./sources/rss.js";

const DIR = join(DATA_DIR, "semantic", "v2");
const CHUNK = 300;
const key = (url: string) => url.replace(/\/+$/, "");

/** url → description from every configured feed, read in full. Feeds before pages: a page 403 marks the whole host refused. */
async function feedExcerpts(): Promise<Map<string, string>> {
  const excerpts = new Map<string, string>();
  for (const f of (await loadConfig()).feeds ?? []) {
    try {
      for (const it of parseFeed(await politeText(f.url), f.name, Infinity)) if (it.rawContent) excerpts.set(key(it.url), it.rawContent);
    } catch (err) {
      console.warn(`  ! feed ${f.name}: ${err}`);
    }
  }
  return excerpts;
}

async function main(): Promise<void> {
  try { process.loadEnvFile(join(DATA_DIR, "..", ".env")); } catch { /* the key may come from the environment */ }
  const apiKey = process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_KEY or OPENROUTER_API_KEY is required.");

  const journal = await readFile(join(DIR, "annotations.jsonl"), "utf8").catch(() => "");
  const done = new Set(journal.split("\n").filter(Boolean).map((line) => (JSON.parse(line) as { id: string }).id));
  const pending = (await loadIndex()).filter((e) => !done.has(e.id));
  // Lab pages first: they need fetching, so a stopped run has done the slow part.
  pending.sort((a, b) => Number(a.source === "hackernews") - Number(b.source === "hackernews"));
  console.log(`dataset pending: ${pending.length} (already annotated: ${done.size})`);

  const fromFeeds = await feedExcerpts();
  console.log(`feed descriptions: ${fromFeeds.size}`);
  let fetched = 0, unavailable = 0;
  for (let i = 0; i < pending.length; i += CHUNK) {
    const chunk = await mapLimit(pending.slice(i, i + CHUNK), 24, async (e) => {
      if (e.source === "hackernews") return { ...e, fetch: "none" };
      const feed = fromFeeds.get(key(e.url));
      if (feed) return { ...e, rawContent: feed, fetch: "feed" };
      try {
        const html = await politeText(e.url);
        fetched++;
        return { ...e, rawContent: meta(html, "og:description") ?? meta(html, "description"), fetch: "ok" };
      } catch {
        unavailable++;
        return { ...e, fetch: "failed" };
      }
    });
    const { failed } = await annotateFresh({ items: chunk, directory: DIR, apiKey, concurrency: 8, mode: "backfill" });
    console.log(`  ${Math.min(i + CHUNK, pending.length)}/${pending.length} · pages fetched ${fetched}, unavailable ${unavailable}`);
    // A provider outage would otherwise burn through the whole dataset as failures.
    if (failed > chunk.length / 2) throw new Error(`${failed}/${chunk.length} annotations failed; stopping. Rerun to resume.`);
  }
  console.log("✓ backfill complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
