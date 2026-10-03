import type { CrawlContext, RawItem, Source } from "./types.js";

/**
 * Stage 1 — Crawler. Fetch every source concurrently. A single failing source
 * is logged and skipped; it never sinks the whole run.
 */
export async function crawl(sources: Source[], ctx: CrawlContext): Promise<RawItem[]> {
  const settled = await Promise.allSettled(sources.map((s) => s.fetch(ctx)));
  const items: RawItem[] = [];
  settled.forEach((result, i) => {
    const name = sources[i]!.name;
    if (result.status === "fulfilled") {
      console.log(`  ✓ ${name}: ${result.value.length}`);
      items.push(...result.value);
    } else {
      console.warn(`  ✗ ${name}: ${result.reason}`);
    }
  });
  return items;
}
