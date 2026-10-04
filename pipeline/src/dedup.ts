import { readFile } from "node:fs/promises";
import { itemId } from "./hash.js";
import { SEEN_PATH } from "./paths.js";
import type { RawItem } from "./types.js";

/** id -> ISO timestamp first added to the dataset. */
export type Seen = Record<string, string>;

export async function loadSeen(): Promise<Seen> {
  try {
    return JSON.parse(await readFile(SEEN_PATH, "utf8")) as Seen;
  } catch {
    return {};
  }
}

/**
 * Stage 2 — Add/Skip. Drop items already in the dataset (the cheap gate that
 * runs BEFORE refinement so we never spend tokens on something we'll skip),
 * and collapse duplicates within this batch.
 */
export function partition(items: RawItem[], seen: Seen): { fresh: RawItem[]; skipped: number } {
  const byId = new Map<string, RawItem>();
  for (const item of items) {
    const id = itemId(item.url);
    if (seen[id]) continue;
    const kept = byId.get(id);
    // The first source wins the story (labs are crawled before Hacker News),
    // but Hacker News points still ride along so the story counts as heat.
    if (kept) {
      if (item.score !== undefined && (kept.score ?? -1) < item.score) kept.score = item.score;
      continue;
    }
    byId.set(id, { ...item });
  }
  return { fresh: [...byId.values()], skipped: items.length - byId.size };
}

/**
 * Labs rename posts: the same announcement can reappear under a new slug, so
 * URL ids alone count it twice. Outside Hacker News, a story with the same
 * source, title and publish day is the same story.
 */
export function storyKey(it: { source: string; title: string; publishedAt?: string }): string | undefined {
  if (it.source === "hackernews") return undefined;
  const t = Date.parse(it.publishedAt ?? "");
  if (Number.isNaN(t)) return undefined;
  return `${it.source}|${it.title.trim().toLowerCase()}|${new Date(t).toISOString().slice(0, 10)}`;
}
