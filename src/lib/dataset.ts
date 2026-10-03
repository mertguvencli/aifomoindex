import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { computeFomoIndex, type Coverage, type FomoIndex } from "@/lib/fomo-index";
import { classifyEntities, classifyTopics, publisherOf } from "@/lib/taxonomy";

/** Mirror of pipeline IndexEntry — the shape stored in data/index.json. */
export interface NewsEntry {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  tags: string[];
  importance: number;
  summary: string;
  /** Hacker News points. Absent for other sources. */
  points?: number;
  path: string;
}

/**
 * Read the dataset index at build time. The site is a static export, so this
 * runs once during `next build`, not per request.
 */
export async function getNews(): Promise<NewsEntry[]> {
  try {
    const raw = await readFile(join(process.cwd(), "data", "index.json"), "utf8");
    return JSON.parse(raw) as NewsEntry[];
  } catch {
    return [];
  }
}

/** First-seen times from data/seen.json, the pipeline's dedup ledger. Empty if unreadable. */
async function getSeenTimes(): Promise<number[]> {
  try {
    const raw = await readFile(join(process.cwd(), "data", "seen.json"), "utf8");
    return Object.values(JSON.parse(raw) as Record<string, string>)
      .map((v) => Date.parse(v))
      .filter((t) => !Number.isNaN(t));
  } catch {
    return [];
  }
}

/**
 * When the pipeline last pulled in new stories: the newest first-seen time in
 * data/seen.json. Falls back to the newest story if that file is unreadable.
 */
export async function getUpdatedAt(items: FeedItem[]): Promise<number> {
  const seen = await getSeenTimes();
  if (seen.length) return Math.max(...seen);
  return items.reduce((m, it) => Math.max(m, it.ts), 0);
}

/** data/coverage.json, written by the pipeline's backfill. */
interface CoverageFile {
  historyFrom?: string;
  sources?: Record<string, string>;
}

/**
 * Declared coverage start for each source, as epoch ms.
 * Sources listed in data/coverage.json were backfilled from that date. Any
 * other source counts from the first time the pipeline saw one of its stories,
 * because anything older came from a feed's short tail, not a full archive.
 */
export async function getCoverage(): Promise<Coverage> {
  let file: CoverageFile = {};
  try {
    file = JSON.parse(await readFile(join(process.cwd(), "data", "coverage.json"), "utf8")) as CoverageFile;
  } catch {}
  let seen: Record<string, string> = {};
  try {
    seen = JSON.parse(await readFile(join(process.cwd(), "data", "seen.json"), "utf8")) as Record<string, string>;
  } catch {}

  const sources: Record<string, number> = {};
  for (const e of await getNews()) {
    const t = Date.parse(seen[e.id] ?? "");
    if (!Number.isNaN(t) && t < (sources[e.source] ?? Infinity)) sources[e.source] = t;
  }
  for (const [name, date] of Object.entries(file.sources ?? {})) {
    const t = Date.parse(date);
    if (!Number.isNaN(t)) sources[name] = t;
  }
  const firstSeen = Object.values(seen).map((v) => Date.parse(v)).filter((t) => !Number.isNaN(t));
  const historyFrom = Date.parse(file.historyFrom ?? "");
  return {
    sources,
    historyFrom: Number.isNaN(historyFrom) ? (firstSeen.length ? Math.min(...firstSeen) : Date.now()) : historyFrom,
  };
}

/**
 * The AI FOMO Index as of the latest first-seen record. Anchored to `updatedAt`, not
 * build time, so rebuilding the same data always yields the same number.
 */
export async function getFomoIndex(items: FeedItem[], updatedAt: number): Promise<FomoIndex> {
  return computeFomoIndex(items, updatedAt, await getCoverage());
}

/** A NewsEntry normalized for the site: numeric timestamp, domain, derived facets. */
export interface FeedItem {
  id: string;
  title: string;
  url: string;
  /** The crawler that found it; the index and coverage count by this. */
  source: string;
  /** Who published it, for display and filters: a lab for its own posts found on Hacker News. */
  publisher: string;
  domain: string;
  /** Epoch ms. `publishedAt` mixes ISO and RFC 2822, so it's parsed once here. */
  ts: number;
  importance: number;
  /** Hacker News points, when known. */
  points?: number;
  /** Omitted when the pipeline had nothing beyond the title. */
  summary?: string;
  topics: string[];
  entities: string[];
}

/** Newest-first feed, ready for client-side filtering. */
export async function getFeed(): Promise<FeedItem[]> {
  const entries = await getNews();
  return entries
    .map((e) => {
      const ts = Date.parse(e.publishedAt);
      let domain = "";
      try {
        domain = new URL(e.url).hostname.replace(/^www\./, "");
      } catch {}
      const publisher = publisherOf(e.source, domain);
      const summary = e.summary && e.summary.trim() !== e.title.trim() ? e.summary : undefined;
      return {
        id: e.id,
        title: e.title,
        url: e.url,
        source: e.source,
        publisher,
        domain,
        ts: Number.isNaN(ts) ? 0 : ts,
        importance: e.importance,
        ...(e.points !== undefined && { points: e.points }),
        ...(summary && { summary }),
        topics: classifyTopics(e.title, e.source),
        entities: classifyEntities(e.title, publisher),
      };
    })
    .sort((a, b) => b.ts - a.ts);
}
