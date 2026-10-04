import { crawl } from "./crawl.js";
import { loadSeen, partition, storyKey } from "./dedup.js";
import { finalize, isBlocked, loadIndex, purge, rescore, writeIndex } from "./finalize.js";
import { itemId } from "./hash.js";
import { refine } from "./refine.js";
import { annotateFresh } from "../../scripts/semantic/annotate-fresh.mjs";
import { loadConfig, loadSources } from "./sources/index.js";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, SEEN_PATH } from "./paths.js";
import type { NewsItem } from "./types.js";

async function main(): Promise<void> {
  const seen = await loadSeen();
  const blocked = (await loadConfig()).blockedHosts ?? [];

  console.log("→ Purge");
  const index = await loadIndex();
  const purged = await purge(index, seen, blocked);
  console.log(`  removed ${purged} stories from blocked hosts`);

  console.log("→ Crawl");
  const sources = await loadSources();
  const known = (url: string) => Boolean(seen[itemId(url)]) || isBlocked(url, blocked);
  const raw = (await crawl(sources, { known })).filter((it) => !isBlocked(it.url, blocked));
  console.log(`  raw total: ${raw.length}`);

  console.log("→ Rescore");
  const rescored = await rescore(index, raw.filter((it) => it.source === "hackernews"));
  if (rescored > 0 || purged > 0) await writeIndex(index);
  if (purged > 0) await writeFile(SEEN_PATH, `${JSON.stringify(seen, null, 2)}\n`);
  console.log(`  updated points on ${rescored} Hacker News stories`);

  console.log("→ Add/Skip");
  const parted = partition(raw, seen);
  // An undated story would be stamped "now" and fake a spike, so it never enters.
  const dated = parted.fresh.filter((it) => !Number.isNaN(Date.parse(it.publishedAt ?? "")));
  const undated = parted.fresh.length - dated.length;
  // A lab post republished under a new URL is not a new story.
  const stories = new Set(index.map(storyKey).filter(Boolean));
  const fresh = dated.filter((it) => {
    const key = storyKey(it);
    if (!key) return true;
    if (stories.has(key)) {
      // Remember the new URL so list pages stop re-fetching it every run. Its
      // publish time, not now: the site reads the newest seen time as "updated".
      seen[itemId(it.url)] = new Date(Date.parse(it.publishedAt!)).toISOString();
      return false;
    }
    stories.add(key);
    return true;
  });
  const renamed = dated.length - fresh.length;
  console.log(
    `  fresh: ${fresh.length}, skipped: ${parted.skipped}${undated ? `, undated: ${undated}` : ""}${renamed ? `, republished: ${renamed}` : ""}`,
  );
  if (fresh.length === 0) {
    if (renamed > 0) await writeFile(SEEN_PATH, `${JSON.stringify(seen, null, 2)}\n`);
    console.log("✓ nothing new");
    return;
  }

  console.log("→ Refine");
  const now = new Date().toISOString();
  const refined: NewsItem[] = [];
  for (const item of fresh) {
    const enrichment = refine(item);
    refined.push({
      ...item,
      ...enrichment,
      id: itemId(item.url),
      fetchedAt: now,
      publishedAt: item.publishedAt!,
    });
  }

  console.log("→ Finalize");
  const finalIndex = await finalize(refined, seen);
  console.log(`✓ dataset now holds ${finalIndex.length} items (+${refined.length})`);

  // After finalize, so a provider outage never costs the crawl. The excerpt
  // (rawContent) is only in memory here and is never written to the dataset.
  console.log("→ Annotate (Jev v2)");
  try {
    await annotateFresh({
      items: refined,
      directory: join(DATA_DIR, "semantic", "v2"),
      apiKey: process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY,
    });
  } catch (err) {
    console.warn(`  ! Jev v2 annotation failed: ${err}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
