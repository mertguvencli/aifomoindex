import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Seen } from "./dedup.js";
import { DATA_DIR, INDEX_PATH, SEEN_PATH } from "./paths.js";
import { itemId } from "./hash.js";
import type { IndexEntry, NewsItem, RawItem } from "./types.js";

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** news/YYYY/MM/DD/<id>-<slug>.md — sortable, collision-free, browsable. */
function relPath(item: NewsItem): string {
  const d = new Date(item.publishedAt);
  const y = String(d.getUTCFullYear());
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return join("news", y, m, day, `${item.id}-${slug(item.title)}.md`);
}

function toMarkdown(item: NewsItem): string {
  return [
    "---",
    `id: ${item.id}`,
    `title: ${JSON.stringify(item.title)}`,
    `url: ${item.url}`,
    `source: ${item.source}`,
    `published_at: ${item.publishedAt}`,
    `fetched_at: ${item.fetchedAt}`,
    `importance: ${item.importance}`,
    ...(item.score !== undefined ? [`points: ${item.score}`] : []),
    `tags: [${item.tags.join(", ")}]`,
    "---",
    "",
    `# ${item.title}`,
    "",
    item.summary,
    "",
    `[Read the source →](${item.url})`,
    "",
  ].join("\n");
}

export async function loadIndex(): Promise<IndexEntry[]> {
  try {
    return JSON.parse(await readFile(INDEX_PATH, "utf8")) as IndexEntry[];
  } catch {
    return [];
  }
}

/**
 * Stage 4 — Finalize. Write one markdown file per item, then refresh the two
 * derived files: index.json (newest first) and seen.json (the dedup ledger).
 */
export async function finalize(items: NewsItem[], seen: Seen): Promise<IndexEntry[]> {
  const index = await loadIndex();
  for (const item of items) {
    const rel = relPath(item);
    const abs = join(DATA_DIR, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, toMarkdown(item));
    index.push({
      id: item.id,
      title: item.title,
      url: item.url,
      source: item.source,
      publishedAt: item.publishedAt,
      tags: item.tags,
      importance: item.importance,
      summary: item.summary,
      ...(item.score !== undefined && { points: item.score }),
      path: rel,
    });
    seen[item.id] = item.fetchedAt;
  }
  await writeIndex(index);
  await writeFile(SEEN_PATH, `${JSON.stringify(seen, null, 2)}\n`);
  return index;
}

/** `publishedAt` mixes RFC 2822 and ISO strings, so sort by the parsed time. */
const time = (e: IndexEntry) => Date.parse(e.publishedAt) || 0;

export async function writeIndex(index: IndexEntry[]): Promise<void> {
  index.sort((a, b) => time(b) - time(a));
  await writeFile(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`);
}

/** True if `url` is on a blocked host or one of its subdomains. */
export function isBlocked(url: string, blockedHosts: string[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return false;
  }
  return blockedHosts.some((b) => {
    const h = b.replace(/^www\./, "").toLowerCase();
    return host === h || host.endsWith(`.${h}`);
  });
}

/**
 * Remove every story from a blocked host: its index row, its markdown file and
 * its dedup entry. Returns how many were removed. The caller writes the index
 * and seen.json.
 */
export async function purge(index: IndexEntry[], seen: Seen, blockedHosts: string[]): Promise<number> {
  if (blockedHosts.length === 0) return 0;
  let removed = 0;
  for (let i = index.length - 1; i >= 0; i--) {
    const e = index[i]!;
    if (!isBlocked(e.url, blockedHosts)) continue;
    index.splice(i, 1);
    delete seen[e.id];
    await rm(join(DATA_DIR, e.path), { force: true });
    removed++;
  }
  return removed;
}

/** Points at or above this make a Hacker News story "must-read heat". */
export const HEAT_POINTS = 200;

/**
 * Refresh the Hacker News points of stories already in the dataset, whatever
 * their source: a lab post can also be a Hacker News hit. Points only grow, so
 * a story is updated when the new count is higher. Importance follows the
 * fallback rule (200+ points → 3). Returns how many entries changed. The
 * caller writes the index.
 */
export async function rescore(index: IndexEntry[], hits: RawItem[]): Promise<number> {
  const byId = new Map(index.map((e) => [e.id, e]));
  let changed = 0;
  for (const hit of hits) {
    if (hit.score === undefined) continue;
    const entry = byId.get(itemId(hit.url));
    if (!entry || (entry.points ?? -1) >= hit.score) continue;
    entry.points = hit.score;
    if (hit.score >= HEAT_POINTS) entry.importance = Math.max(entry.importance, 3);
    await rewriteFrontMatter(entry);
    changed++;
  }
  return changed;
}

/** Keep the story's markdown file in step with its index row. */
export async function rewriteFrontMatter(entry: IndexEntry): Promise<void> {
  const abs = join(DATA_DIR, entry.path);
  let md: string;
  try {
    md = await readFile(abs, "utf8");
  } catch {
    return;
  }
  md = md.replace(/^source: .*$/m, `source: ${entry.source}`);
  md = md.replace(/^importance: .*$/m, `importance: ${entry.importance}`);
  md = md.replace(/^tags: .*$/m, `tags: [${entry.tags.join(", ")}]`);
  if (entry.points !== undefined) {
    const points = `points: ${entry.points}`;
    md = /^points: .*$/m.test(md) ? md.replace(/^points: .*$/m, points) : md.replace(/^(importance: .*)$/m, `$1\n${points}`);
  }
  await writeFile(abs, md);
}
